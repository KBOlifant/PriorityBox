# Architecture

Priority is a single Next.js app (React, Tailwind, Framer Motion) that will be
packaged with Electron. There is no separate backend: everything the app needs
from the outside world goes through the **services** layer.

## Layers

```
app/ + components/      UI: screens and presentational pieces
        │
lib/                    App logic: React hooks, the local store, selectors, types
        │
services/               All network and database calls (the only place SDKs are imported)
        │
Firebase Auth · Firestore · Groq
```

Rules:

- Components never import `firebase/*` or call `fetch` for external APIs. They
  go through `lib/` hooks or call a service function.
- Services don't import React. They take plain data and return promises, which
  keeps them reusable from Electron's main process later.
- Services throw errors with user-safe messages (`GroqError`, `authErrorMessage`).

## Services

| Folder | Responsibility |
| --- | --- |
| `services/firebase.ts` | One shared Firebase app: exports `auth` and `db` |
| `services/auth/` | Sign in, sign up, Google sign-in, password reset, sign out, auth-state listener, error messages |
| `services/firestore/crud.ts` | Generic create / get / list / update / upsert / remove / watch for any collection path. Adds `createdAt` / `updatedAt` |
| `services/firestore/users.ts` | `users/{uid}` profile CRUD |
| `services/firestore/messageState.ts` | `users/{uid}/messageState/{messageId}` CRUD for the user's own edits (priority, remarks) |
| `services/groq/` | `summarizeEmail` and `draftReply` using `openai/gpt-oss-120b`; `agent.ts` runs the AI bar as a multi-step tool agent (find, group, re-mark, remember urgency rules) |
| `services/firestore/folders.ts` | "Grouped Emails": `users/{uid}/folders/{id}` and `…/items/{messageId}` (references only, no email text) |
| `services/idb.ts`, `services/cache/` | On-device IndexedDB key-value store with expiry; the cache in front of Firestore reads and AI responses |
| `services/mailStore.ts` | Emails and recent search results kept in IndexedDB so the mailbox APIs are called once per message |
| `services/mail/` | Real inboxes behind one `MailProvider` interface: `gmail.ts` (Google Identity Services + Gmail API), `outlook.ts` (MSAL + Microsoft Graph), `parse.ts` (normalising messages), `classify.ts` (AI priority, dates and progress) |
| `services/firestore/mailAccounts.ts` | Which accounts are connected: `users/{uid}/mailAccounts/{provider}` (address only, never tokens) |
| `services/firestore/classifications.ts` | AI analysis per message: `users/{uid}/classifications/{messageId}` (no email text) |
| `services/safely.ts` | Deadline + error swallowing for optional Firestore calls |

Adding a new kind of data: add a typed module next to `users.ts` that wraps
`crud.ts`, and export it from `services/firestore/index.ts`.

## Data

- All user data lives under `users/{uid}`; `firestore.rules` restricts each
  user to their own subtree. Deploy the rules from the Firebase console or CLI.
- Messages are still sample data (`lib/mock-data.ts`). The local store
  (`lib/store.ts`) keeps edits in `localStorage`. Moving that to
  `messageState` is the next step: the store would call the service and
  subscribe with `watchMessageStates`.

## Secrets

- Firebase web config is public by design; security comes from Auth and the
  Firestore rules.
- `NEXT_PUBLIC_GROQ_API_KEY` is bundled into the client, so anyone who gets the
  app can extract it. Acceptable while developing. Before distributing the
  Electron app, move `services/groq` calls into the Electron main process
  (key read from the OS keychain or an env var there) and expose them through
  an IPC channel. The service function signatures can stay the same.

## Real mail

`lib/mail.ts` runs the sync: saved accounts -> restore tokens -> fetch the 25
newest inbox messages per account -> show them immediately -> classify with
Groq -> update the screens. With no account connected the app shows the sample
data (`lib/mock-data.ts`).

- Tokens live in `sessionStorage` (Google ~1h, Microsoft via MSAL). When one
  can't be renewed silently the account is flagged "needs reconnect".
- A copy of the loaded inbox is kept in `localStorage` (`services/mailCache.ts`)
  so emails survive a refresh when the login can't be renewed silently. The
  user chooses how long it lives (gear menu: don't keep / 1h / 6h / 24h / 7 days,
  default 24h). It is never uploaded, and is cleared on expiry, sign-out,
  disconnecting an account, or "Clear saved emails now".
- Message text is never stored in Firestore. Only the AI analysis and the
  connected account addresses are.
- Email text is sent to Groq for classification, summaries and drafts.
- Gmail uses the restricted `gmail.readonly` scope. Until Google verifies the
  app, only accounts listed as test users can connect.

### Saved for later

Emails are saved in `users/{uid}/savedEmails/{id}`: a **reference** (provider,
account, message id, sender and address, subject) plus the same editable fields
as a manual entry: activity (starts as the subject), event date, progress
comment, remarks, and the AI-set meter and stage. The email body is never
stored. High priority emails are saved automatically (`SavedSync` in
`components/mail-sync.tsx`) and any email can be saved with the bookmark button.
Removing one keeps a `removed` marker so auto-save doesn't bring it back.

On the Saved screen each item can be edited with the same form as a manual
entry (`components/manual-editor.tsx`, `editSavedEntry` in `lib/saved.ts`), and
has every AI feature: summary and follow-up draft work through `savedToMessage`,
which presents the saved item as a normal message (using the real body when the
email is loaded or has been opened with "Read email", otherwise the user's
notes). "Read email" fetches the message by id (`MailProvider.fetchMessage`), so
it needs the account to be connected.

Gmail links are built by `gmailLink` in `services/mail/parse.ts` (account in
`authuser`, `#all/<id>`) and always rebuilt at display time, so links stored
earlier in an old format still work.

**Storing email text later (encrypted):** keep it behind the same two seams,
`services/firestore/savedEmails.ts` for storage and `savedToMessage` for what the
AI sees. An encrypted store would hold the body and `savedToMessage` would read
it from there, with no change to the screens.

### Manual mode

For people who can't connect a mailbox, the **Inbox | Manual** switch in the top
bar swaps the screens over to entries typed in by hand
(`users/{uid}/manualEntries/{id}`). Each entry has an activity (what the email
is about), an optional event date (date picker), a progress comment and
remarks. The AI sets the progress meter and stage from the progress comment
(`services/groq/progress.ts`), and only re-rates when the activity, date or
comment changes. Entries become ordinary cards (`lib/manual-map.ts`), so the
Priority, Waiting, Events and Archive screens and the AI bar work unchanged.
Edits made on a card (priority, remarks, complete) are written to the entry
itself (`lib/manual.ts`), not kept as browser-side overrides. Unlike connected
mail, these entries are stored in full, because the user wrote them.

### Offline and disconnected use

- Firestore keeps a copy of the user's data on the device (`services/firebase.ts`).
  Reads for manual entries and saved emails show that copy first, then refresh from
  the server (`listManualEntriesCached`, `listSavedEmailsCached`). Writes don't wait for
  the server (`inBackground` in `services/safely.ts`): they show at once and Firestore
  sends them when the connection returns.
- Manual mode therefore works with no connection. Only the AI parts are switched off
  (`lib/online.ts`): the AI bar, summaries, follow-up drafts and the progress meter,
  which stays "Not rated" until the entry is edited online.
- Disconnecting an inbox never removes saved emails. When an email is saved its text
  is also kept on this device only (`services/savedBodies.ts`, localStorage, never in
  Firestore), so "Read email" works without the inbox. Those copies go when the email
  is removed from Saved or the user signs out. Emails saved before this existed get
  their copy the next time they are loaded or read.

### Paging

`services/mail/pager.ts` merges all connected accounts newest-first and hands
out pages of exactly 25. Each account is fetched lazily (Gmail `pageToken`,
Graph `$skip`), so "Next" only fetches what that page needs. Pages already
fetched are kept, so "Previous" is instant. Page analysis is queued one page at
a time, because Groq's free tier allows 8,000 tokens per minute.

### AI bar

The input next to search runs `services/groq/agent.ts`: Groq works through the
inbox in up to 6 steps with tools, and the app carries them out:

| Tool | What Groq gets back |
| --- | --- |
| `senders` / `pick_senders` | sender **names only**, then every email from the chosen senders |
| `keyword` | local, typo-tolerant search (`lib/fuzzy.ts`, `lib/mail-index.ts`) with an ~80 char excerpt per hit |
| `search_inbox` | searches **older inbox mail** on the server (Gmail `q`, Outlook `$search`); found emails are listed in the inbox after the loaded pages |
| `list` / `read` | pool rows, or up to 8 email bodies (the only tool that sends whole emails) |
| `drop` / `mark` / `show` / `remember` / `finish` | settle the result; `finish` may suggest a folder name |

Token saving: each step is a fresh prompt built from a compact state (the
instruction, the model's own ≤200-char notes, pool counts and only the last
step's results); earlier steps are never resent and dropped emails never come
back. The run stops at a token budget. Groq is told to fix the user's spelling
before searching, and the local index also matches typos (edit distance with
letter swaps, same first letter) and longer forms.

If a server search would match more than ~3 pages, `SearchScopeModal` asks how
far back to search, with estimated email counts and token use per range.
A result list can be saved as a folder ("Grouped Emails").

Guard rails:

- The mailbox scopes are read-only (`gmail.readonly`, `Mail.Read`); the AI can't
  send, delete, archive or move mail.
- The AI only proposes changes. Priority changes (with a preview of the affected
  emails) and new urgency rules wait for **Apply** / **Remember**, and applied
  changes can be undone. Showing a result list is the only thing it does alone.
- Email text in the agent's prompts is fenced in `<email>` tags (look-alike tags
  inside emails are stripped first), and the prompt says that text, sender names
  and subjects are untrusted and must never be followed.
- Replies are validated against a whitelist of tools and the refs the app handed
  out; per-run limits on turns, tokens, emails read and emails fetched.
- Custom memory (Settings) can only be written by the user.

Who an email is from is matched in code (`services/groq/peopleMatch.ts`), not
by the model, across names, addresses and companies.

### Caching

Everything cached lives in IndexedDB on the device (`services/idb.ts`) and is
cleared on sign-out: Firestore classifications and accounts, AI summaries and
drafts, fetched emails (3 days) and server search results (15 minutes). Folder
emails are fetched by id when opened, then kept on the device.

### Setup

**Gmail** (Google Cloud console, the project behind the Firebase app is fine)

1. Enable the **Gmail API**.
2. OAuth consent screen: user type External, add scope
   `https://www.googleapis.com/auth/gmail.readonly`, add yourself under Test users.
3. Credentials -> Create OAuth client ID -> **Web application**, with authorized
   JavaScript origin `http://localhost:3000`.
4. Put the client ID in `.env` as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

**Outlook** (Microsoft Entra admin center -> App registrations)

1. New registration, supported account types **Accounts in any organizational
   directory and personal Microsoft accounts**.
2. Authentication -> Add platform -> **Single-page application**, redirect URI
   `http://localhost:3000/auth/redirect`.
3. API permissions -> Microsoft Graph -> Delegated: `Mail.Read` and `User.Read`.
4. Put the Application (client) ID in `.env` as `NEXT_PUBLIC_MICROSOFT_CLIENT_ID`.

Restart the dev server after changing `.env`, then use **Connect inbox** in the
sidebar.

## Planned

- Move the mail providers into Electron's main process (loopback OAuth with
  PKCE, tokens in the OS keychain) so tokens never reach the renderer and
  sessions survive restarts. `MailProvider` is the seam for that move.
- Refresh tokens / background sync, and loading more than the latest 25 messages.

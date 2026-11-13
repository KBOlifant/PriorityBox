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
| `services/groq/` | `summarizeEmail` and `draftReply` using `openai/gpt-oss-120b` |
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
- Message text is never stored in Firestore. Only the AI analysis and the
  connected account addresses are.
- Email text is sent to Groq for classification, summaries and drafts.
- Gmail uses the restricted `gmail.readonly` scope. Until Google verifies the
  app, only accounts listed as test users can connect.

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

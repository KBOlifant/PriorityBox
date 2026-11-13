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
| `services/firestore/aiResponses.ts` | `users/{uid}/aiResponses/{messageId}` CRUD for the saved summary and follow-up draft |
| `services/groq/` | `summarizeEmail` and `draftReply` using `openai/gpt-oss-120b` |
| `services/cache/` | Redis-shaped async cache (`get` / `set` with TTL / `del`). Currently a `sessionStorage` placeholder; swap `cache` for a Redis client once Electron is in place |
| `services/aiResponses.ts` | Combines the three above. Reads go cache → Firestore → Groq; writes go to the cache and Firestore. Firestore waits are capped at 4s so AI keeps working if storage is unreachable |

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

## Planned

- Gmail (Google OAuth, desktop client + PKCE) and Outlook (Microsoft Graph, MSAL)
  as new services behind one mail-provider interface, running in Electron's
  main process so tokens never reach the renderer.
- Replace `lib/mock-data.ts` with provider data.

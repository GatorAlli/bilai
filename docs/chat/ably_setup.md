# Ably Chat + React UI Kit setup

Basic plumbing for Ably Chat, so the next piece of work is the chat feature
itself (rooms, message UI, who-can-message-whom) and not auth wiring. Nothing
here renders a chat UI — it's the client/auth/provider scaffolding the UI
kit needs underneath it.

## What was already in place

- `ABLY_API_KEY` was already in `.env`.
- `@ably/chat` and `@ably/pubsub-device` were already dependencies (unused
  until now).

## Packages added

```bash
npm install @ably/chat-react-ui-kit@^0.4.0 @ably/pubsub-server@^3.1.0
```

- **`@ably/chat-react-ui-kit`** — the ready-made chat UI components
  (`App`, `ChatWindow`, `Sidebar`, …) and the providers they need
  (`ThemeProvider`, `AvatarProvider`, `ChatSettingsProvider`).
- **`@ably/pubsub-server`** — Ably's server-side client factory
  (`createHttpClient` / `createRealtimeClient`). This is **not** the same
  package as `@ably/pubsub-device` (browser/end-user side) — Ably splits the
  SDK by which side of the connection you're on, so server traffic isn't
  billed as a monthly active user. Needed here only to sign token requests.

`package.json` now has both under `dependencies` (not `devDependencies` —
the token route imports `@ably/pubsub-server` at request time, and the chat
provider imports `@ably/chat-react-ui-kit` in a browser bundle).

## Decision: token auth, not a raw API key in the browser

Ably's own getting-started doc defaults to handing the API key straight to
the browser client (`createClient({ key: '<your-ably-api-key>' })`) and notes
_"In production, you should use token-based authentication to avoid
exposing your API keys publicly."_ `ABLY_API_KEY` in `.env` is a server
secret (no `NEXT_PUBLIC_` prefix), and this repo is already careful about
not leaking secrets to the client (see how `lib/contact.ts` keeps phone
numbers off the page). So this setup skips straight to the production
pattern: a server route signs a short-lived, user-scoped token request; the
browser client fetches it via `authUrl` and never sees the key.

## New files

### `lib/ably.ts` — server-side Ably client

```ts
import "server-only";
import { createHttpClient } from "@ably/pubsub-server";

// Stateless HTTP client used only to sign token requests for browser clients
// (see app/api/ably-token/route.ts). Declaring the server side here, rather
// than in the device SDK, keeps this traffic out of Ably's monthly-active-user
// billing for the app's own backend.
export const ablyServerClient = createHttpClient({
  key: process.env.ABLY_API_KEY!,
});
```

Mirrors the `db/index.ts` pattern already used in this repo: one module-level
client singleton, `import "server-only"` so it can never accidentally end up
in a client bundle (same guard `lib/cats.ts` and `lib/contact.ts` use).

### `app/api/ably-token/route.ts` — token endpoint

```ts
import { getSession } from "@/lib/auth";
import { ablyServerClient } from "@/lib/ably";

// Signs an Ably token request scoped to the signed-in user's id, so the
// browser never sees ABLY_API_KEY. Ably's client SDKs call this via
// ClientOptions.authUrl whenever they need a (new) token.
export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return new Response("Not signed in", { status: 401 });
  }

  const tokenRequest = await ablyServerClient.auth.createTokenRequest({
    clientId: session.user.id,
  });

  return Response.json(tokenRequest);
}
```

Decisions:

- **Re-derives the session server-side** via `getSession()` instead of
  trusting anything from the client — same rule the architecture doc states
  for server actions (`add_a_cat/actions.ts`, `delete-actions.ts`, etc.),
  applied here to a route instead of an action.
- **`clientId: session.user.id`** — this is what ties an Ably connection
  back to a real app user. It comes from `better-auth`'s session, which
  reads through the Drizzle adapter (`lib/auth.ts`'s
  `drizzleAdapter(db, …)`) — this is the "database connection / drizzle
  integration" piece: no new chat-specific tables were added, the existing
  user/session tables are reused as-is.
- **Plain `Response` / `new Response(...)`**, not `NextResponse` — matches
  the convention used by the other route handlers (at the time,
  `app/uploads/[...path]/route.ts`, since removed when photos moved to R2).
- **Why a route and not a server action**: `ClientOptions.authUrl` on the
  Ably client is a URL it `fetch()`s itself; it can't call a server action.
  The architecture doc's "server actions, not API routes" rule already has
  two exceptions (`app/api/auth/[...all]/route.ts`,
  `app/uploads/[...path]/route.ts`, since removed) for the same reason — something external
  needs to hit a real URL. This is a third.

### `components/providers/ChatProviders.tsx` — client + providers

```tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@ably/pubsub-device";
import { createChatClient, type ChatClient } from "@ably/chat";
import { ChatClientProvider } from "@ably/chat/react";
import {
  ThemeProvider,
  AvatarProvider,
  ChatSettingsProvider,
} from "@ably/chat-react-ui-kit";
import "@ably/chat-react-ui-kit/dist/style.css";

// Wrap a chat page/route with this component (not the root layout): it opens
// a realtime connection on mount, which would be wasted on every page view
// for visitors who never touch chat. The page using it should already redirect
// signed-out visitors before rendering, the same way app/(pages)/profile/page.tsx
// does with getSession() - the token route below rejects them anyway.
//
// clientId is intentionally left unset here: /api/ably-token signs the token
// request with the session user's id, and the resolved token carries it.
export function ChatProviders({ children }: { children: React.ReactNode }) {
  const [chatClient, setChatClient] = useState<ChatClient | null>(null);

  useEffect(() => {
    const pubsubClient = createClient({ authUrl: "/api/ably-token" });
    const client = createChatClient(pubsubClient);
    // One-time creation of an external client on mount (empty deps below),
    // not a per-render state sync - safe despite the lint rule's general advice.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChatClient(client);

    return () => {
      void client.dispose();
    };
  }, []);

  if (!chatClient) {
    return (
      <p role="status" className="py-8 text-center text-muted-foreground">
        Connecting to chat…
      </p>
    );
  }

  return (
    <ThemeProvider options={{ persist: true, defaultTheme: "light" }}>
      <AvatarProvider>
        <ChatSettingsProvider>
          <ChatClientProvider client={chatClient}>
            {children}
          </ChatClientProvider>
        </ChatSettingsProvider>
      </AvatarProvider>
    </ThemeProvider>
  );
}
```

Decisions:

- **Not mounted in `app/layout.tsx`.** Ably's own example wraps the whole
  app in `main.tsx`, but that example has no concept of signed-out visitors.
  Here, mounting this in the root layout would open (and immediately fail,
  with a 401) a realtime connection on every page load — the home page, the
  auth page, every listing — for every visitor, logged in or not. Instead,
  mount it only on whatever chat route gets built, after that route has
  already checked `getSession()` and redirected signed-out visitors (exactly
  the pattern `app/(pages)/profile/page.tsx` uses). That also means adding
  this didn't touch `app/layout.tsx` or change the app's rendering model at
  all — root layout stays a plain server component, so `cacheComponents`
  and static rendering on unrelated pages are untouched.
- **Client creation lives inside `useEffect`, not at module scope or in
  `useState`'s lazy initializer.** `createClient(...)` from
  `@ably/pubsub-device` is a browser-only call (it tries to open a
  WebSocket). Next.js server-renders client components too, so anything run
  directly in the component body — including a `useState(() => ...)`
  initializer — would run on the server during SSR. `useEffect` bodies only
  run in the browser after mount, which is what actually guards this.
- **`clientId` is not set in `createClient({ authUrl: ... })`.** The token
  request from `/api/ably-token` already carries `clientId`, and the Ably
  docs are explicit that specifying a conflicting `clientId` on the client
  options throws. Leaving it unset lets the resolved token be the only
  source of truth.
- **Cleanup calls `client.dispose()`** on unmount, per the SDK's own
  guidance that a `ChatClient` should be disposed when you're done with it
  (releases all rooms and closes the connection) — otherwise navigating away
  from a chat page would leak an open realtime connection.
- **`eslint-disable-next-line react-hooks/set-state-in-effect`**: the
  `eslint-config-next` / `react-hooks` lint rule flags any synchronous
  `setState` call inside an effect body as a potential cascading-render
  smell, and suggests calling it instead from a subscription callback. This
  effect runs once on mount (empty dependency array) to create an external
  resource and publish a reference to it — there's no real cascade risk,
  and there's no natural async callback to move the call into. Disabled
  with a one-line reason rather than restructured to dodge the rule.
- **Loading fallback while `chatClient` is null**: `ChatClientProvider`'s
  `client` prop is required (non-nullable), so something has to render
  before the first client exists. A plain status paragraph for now — once
  an actual chat page/layout exists it probably wants a real skeleton
  rather than this one.

## `AGENTS.md`

Updated the "Project file structure" section (per the repo's own working
agreement 2) to list the three new files:

```diff
-│   ├── api/auth/[...all]/route.ts # better-auth catch-all handler (the only API route besides uploads)
+│   ├── api/auth/[...all]/route.ts # better-auth catch-all handler
+│   ├── api/ably-token/route.ts    # Signs Ably token requests scoped to the session user's id
 │   ├── uploads/[...path]/route.ts # Serves listing photo bytes; contains the path-traversal guard
```

```diff
 │   ├── auth/
 │   │   ├── AuthForm.tsx           # Email/password sign-in and sign-up form
 │   │   ├── LoginForm.tsx          # Login-card wrapper (form + Google button)
 │   │   └── signOut.tsx            # Sign-out button
+│   ├── providers/
+│   │   └── ChatProviders.tsx      # Ably Chat client + UI kit provider wrapper for chat pages
```

```diff
 │   ├── auth.ts                    # better-auth server config, `getSession()`, sign-up phone hook
 │   ├── auth-client.ts             # better-auth browser client
+│   ├── ably.ts                    # Server-only Ably HTTP client (`@ably/pubsub-server`) for token signing
```

(`CLAUDE.md` imports `AGENTS.md` verbatim, so nothing needed updating there.)

## What was deliberately **not** done

- **No chat UI, no rooms, no message schema.** The ask was setup only — the
  user explicitly wants to build "the actual chat stuff" next.
- **No new Drizzle tables.** Ably Chat stores room/message state itself;
  nothing here needed a new `chat_rooms` or `chat_messages` table. If the
  eventual feature needs to persist which users can message which (e.g. a
  listing owner ↔ interested adopter pairing) that's a real schema decision
  for the next piece of work, not something to guess at here.
- **No `app/globals.css` changes.** The UI kit ships prebuilt CSS
  (`@ably/chat-react-ui-kit/dist/style.css`); it's imported directly in
  `ChatProviders.tsx` so its cost is scoped to whatever page actually
  mounts chat, rather than loaded on every page via `globals.css`.
- **`npm audit` reports 22 pre-existing vulnerabilities** (unrelated to the
  two packages added here — same count shows on `main` before this change).
  Not touched; `npm audit fix --force` would pull in breaking changes and
  wasn't asked for.

## How to use this next

When building the actual chat page/route, follow the same session-guard
pattern as `app/(pages)/profile/page.tsx`, then wrap just that page's
content:

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ChatProviders } from "@/components/providers/ChatProviders";

export default async function MessagesPage() {
  const session = await getSession();
  if (!session?.user) redirect("/auth");

  return (
    <ChatProviders>
      {/* e.g. <App initialRoomNames={[...]} /> from @ably/chat-react-ui-kit,
          or ChatRoomProvider + ChatWindow/Sidebar for more control */}
    </ChatProviders>
  );
}
```

## Verification

- `npx tsc --noEmit` — clean.
- `npm run lint` — clean (after the one documented `eslint-disable-next-line`).
- `npm run format:check` — clean (files were written through the
  Prettier-on-save hook).
- `npm run test` — all 22 vitest + 8 node:test cases still pass.
- Hit the running dev server directly:
  - `GET /api/ably-token` while signed out → `401 Not signed in` (no stack
    trace, no leaked key).
  - `/`, `/find_a_cat` → still `200`, unaffected by the new files since
    nothing was mounted in the root layout.

## Webhook: mirroring chat into Postgres

Added with the chat feature ([[chat_button_plan]], phase 4). Ably POSTs every
chat message, edit and delete to `app/api/ably-webhook/route.ts`, which
checks Ably's signature and writes `chat_messages` through
`recordChatMessages()` in `lib/chat.ts`.

### Dashboard setup (once per environment)

In the Ably dashboard for this app: **Integrations → New integration rule →
Webhook**.

| Setting        | Value                                                        |
| -------------- | ------------------------------------------------------------ |
| URL            | `https://<your-host>/api/ably-webhook`                       |
| Source         | `channel.message`                                            |
| Channel filter | `^dm:` (regex; chat rooms are `dm:<userA>:<userB>::$chat`)   |
| Encoding       | JSON                                                         |
| Request mode   | Batched, **enveloped**                                       |
| Sign with key  | The same key as `ABLY_API_KEY` (the route checks against it) |

No new environment variables: the route verifies `X-Ably-Signature` (HMAC
SHA-256 of the raw body, base64) with the secret half of `ABLY_API_KEY`, and
checks `X-Ably-Key` matches its key name.

**Local development:** Ably can't reach `localhost`. Run a tunnel (e.g.
`cloudflared tunnel --url http://localhost:3000` or `ngrok http 3000`) and
add a separate dev rule pointing at the tunnel URL. Without it, chat still
works live; only the Postgres copy (and so unread counts) stays empty.

### What was checked against live Ably (2026-11-19)

- A chat room `X` is the Pub/Sub channel `X::$chat`. Capability keys are the
  room name (`X`), and a token for one room is refused on another (40160).
- Decoded with `Message.fromEncodedArray()` (exported by
  `@ably/pubsub-server`), `action` is `message.create` / `message.update` /
  `message.delete`, `timestamp` keeps the original send time on edits and
  deletes, `version.serial` grows with every change, and the text is in
  `data.text`. The webhook also accepts the numeric wire values (0/1/2).
- The route returns 500 if a database write fails, so Ably retries; writes
  are idempotent (keyed by serial, newer `version_serial` wins).

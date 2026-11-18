---
title: Chat implementation report
status: done
created: 2026-11-19
branch: feat/chat
tags:
  - bilai
  - chat
  - report
related:
  - "[[chat_button_plan]]"
  - "[[ably_setup]]"
---

# Chat implementation report

> [!summary]
> All nine phases of [[chat_button_plan]] are built on branch `feat/chat`, with one commit per phase. Adopters can press **Chat** on a cat page. That opens a chat dock at the bottom right, prefilled with the cat's name and link, and the message goes to the parent in real time. Edits, deletes and typing indicators work, and there's an unread badge. Nothing has been pushed or merged.
>
> **Before chat is complete in a deployed environment**, someone has to create the Ably webhook rule (see [[#What's left]]). Without it, chat still works live, but nothing is copied to Postgres, so unread badges stay at 0.

## Commits

| Phase | Commit        | What it does                                                                                                             |
| ----- | ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1     | `f96ab4f`     | `chat_threads`, `chat_messages`, `chat_reads` tables plus a hand-written migration                                       |
| 2     | `1995806`     | `lib/chat.ts` data layer, `lib/chat-rooms.ts` helpers (with vitest tests), `lib/chat-limits.ts`, the `started_by` column |
| 3     | `c0979ac`     | Ably tokens cover only the user's own rooms                                                                              |
| 4     | `80417d8`     | Signed Ably webhook that copies messages, edits and deletes into Postgres                                                |
| 5     | `14a38a0`     | Chat dock on every page (tab, compact and extended sizes, phone sheet, signed-out state)                                 |
| 6     | `874cbc4`     | Chat button on cat pages (`Chat · WhatsApp · Call`), `openThread` action, prefill                                        |
| 7     | `75d7086`     | Unread badge on the dock tab, conversations marked read when viewed                                                      |
| 8     | `3a450e8`     | Tests for the thread limits and webhook signature checks (the limits themselves came in phases 2, 4 and 5)               |
| 9     | (this commit) | Docs: `AGENTS.md` architecture notes, plan status, this report                                                           |

## Database changes (applied to the database in `.env`)

- `drizzle/20261119000000_chat`: the three chat tables.
- `drizzle/20261119010000_chat_thread_started_by`: who started each conversation, used for the new-chats-per-hour limit.

Both were applied by running the SQL directly, because this database has no Drizzle migrations table (earlier migrations were also applied by hand). `npx drizzle-kit migrate` would try to re-run every migration from the first, so **don't use it here**. Run each new migration file on its own, as [[ably_setup]] and `AGENTS.md` now describe.

## Changes compared with the plan

> [!warning] Problems found and fixed during the build
>
> - **The UI kit's CSS would have broken the site.** `@ably/chat-react-ui-kit/dist/style.css` contains an unlayered Tailwind v3 reset (for example `button{background-color:transparent;padding:0}` and `html{font-family:Inter}`). Our Tailwind v4 utilities sit inside cascade layers, and unlayered CSS always wins over layered CSS. So once chat loaded, every button on the page would have lost its background and padding. **Fix:** the kit's CSS now loads into an `ably-chat` layer, ordered between `base` and `utilities` at the top of `app/globals.css`. After this change, the page's own buttons kept their styling in the browser.
> - **The kit's `ThemeProvider` could switch the whole site to dark mode.** It toggles `dark` on `<html>`, using the visitor's system or saved preference. It's now pinned to light, with no persistence and no system detection.
> - **`useMessageWindow` isn't exported by the kit.** I wrote `components/chat/useConversationMessages.ts` on top of `@ably/chat/react`'s `useMessages`. It loads history with `historyBeforeSubscribe`, and applies live edits and deletes with `Message.with()`.
> - **The kit's `ChatWindow` shows raw room ids.** Its labels and placeholder would read "Message dm:\<id\>:\<id\>". The conversation is built from `ChatWindowHeader`, `ChatMessageList` and `ChatWindowFooter` plus our own `Composer`, which also makes the prefill possible.
> - **Esc in the kit's own dialogs closed the whole dock.** The dock now ignores Esc while a kit modal (such as "Delete message?") or the inline message editor is open.
> - **The dock rendered in the dark root palette.** It sits outside `BilaiPage`, so it now adds the `bilai-theme` class itself.

> [!note] Smaller changes
>
> - **New-chats-per-hour limit:** a `started_by` column means only chats the user opened count. Without it, an owner who received many inquiries would have hit the limit.
> - **Ordering check:** the `user_a < user_b` check uses `COLLATE "C"`, so it always matches JavaScript's sort order. This database is already `C.UTF-8`, but a fresh database with a language-specific sort order would otherwise reject some pairs.
> - **Webhook:** it writes to the database before replying instead of using `after()`, so a failed write returns 500 and Ably retries. Writes are idempotent, so a retry can't create duplicates.
> - **Unread badge:** the root layout doesn't re-render on client-side navigation, so the dock re-fetches the count when the route changes and when the dock is hidden.
> - **Owner notes on the cat page** now say adopters can reach the owner by Bilai chat.
> - `cats_contact_method_check` already requires WhatsApp or Call to be on, so the "no contact method" case can't happen. Chat still shows when the parent has no phone number.

## Ably behaviour, checked against Ably itself

| Question                               | Answer                                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Chat room → channel name               | `<room>::$chat`                                                                                          |
| Capability key for a room              | The room name. A token for room A was **refused (40160)** on room B.                                     |
| Webhook action values (after decoding) | `message.create` / `message.update` / `message.delete`. The numeric wire values 0/1/2 are also accepted. |
| `timestamp` on edits and deletes       | Stays the original send time. `version.serial` grows with each change.                                   |
| Where the text is                      | `data.text`                                                                                              |

## Verification

> [!success] Checked
>
> - `npx tsc --noEmit`, `npm run lint`, `npm run format:check` (on the chat files), `npm run test`: **35 vitest and 20 node:test tests pass**.
> - **Data layer**, against the real database using temporary rows that were deleted afterwards: room names, unread counts, the thread list, membership lookup, started-by counts, read marks.
> - **Webhook**, by POSTing signed payloads to the dev server:
>   - A bad signature gets 401.
>   - A repeated delivery creates no duplicate.
>   - An edit applies, and a late, older edit is ignored.
>   - A sender who isn't in the thread is dropped.
>   - A message over 2,000 characters is stored cut to 2,000.
>   - The single enveloped payload form is accepted, and deletes apply.
> - **In the browser**, with two temporary test accounts and a temporary listing, all deleted afterwards:
>   - Signed-out tab and its "Sign in" state; focus handling; Esc; a phone-width full-screen sheet with no horizontal scroll.
>   - Buttons read `Chat · WhatsApp · Call`.
>   - Pressing Chat opens the dock prefilled. The message sends, and the test parent (using a real token from `/api/ably-token`) saw it in history and replied. The reply appeared live, with the right name and avatar.
>   - Edit shows "(edited)"; delete asks for confirmation, then shows "Message deleted"; there's no reaction button.
>   - Extended layout.
>   - Unread badge shows "2 unread", clears when the thread is opened, and the read mark persists.
>   - The page's own buttons keep their styling after the kit CSS loads.
>   - With the dock never opened, the page makes **no Ably requests** and loads no kit CSS.

> [!caution] Not checked
>
> - **A real Ably → webhook delivery.** There's no dashboard rule yet, and local dev would need a tunnel. The route was tested with hand-signed payloads built to Ably's documented and observed shapes.
> - **The typing indicator, visually.** The test parent sent a keystroke, but I didn't capture it on screen.
> - **Real phones and Safari.** Only Chromium was used, with phone-width emulation. The composer's auto-growing height uses `field-sizing: content`, which older Safari ignores; there it stays one line and scrolls.
> - **Owners seeing a brand-new chat while their dock is already open.** It shows up the next time they reopen the dock or load a page, not instantly. This is a design limit, covered under [[#What's left]].
> - **Your in-progress edits** (`components/view/*`, `app/page.tsx`, `tests/delete-listing.test.mjs`, `DeleteListingButton.tsx`) were never staged and aren't in any commit.

## What's left

> [!todo] Needed before chat is complete in a deployed environment
>
> - [ ] **Create the Ably webhook rule** for each environment. Steps are in [[ably_setup#Webhook: mirroring chat into Postgres]]: source `channel.message`, filter `^dm:`, batched and enveloped, signed with the `ABLY_API_KEY` key.
> - [ ] For local unread counts, run a tunnel (`cloudflared` or `ngrok`) and add a dev rule pointing at it.
> - [ ] Push `feat/chat` and open a PR when you're happy with it.

> [!info] Possible follow-ups (not built)
>
> - **Live unread updates and new-chat notices while the dock is closed.** The webhook could publish to the `inbox:<userId>` channel, which every token can already subscribe to. The cost is opening an Ably connection on every page.
> - **Enforcing the length limit in Ably itself.** Ably's custom moderation (a check before each message is published) would do it. Today the 2,000-character limit is enforced in the composer and when storing, but someone calling Ably directly could still send a longer message.
> - Block and report, which were deferred by decision.
> - Rebuild the Drizzle snapshots so `drizzle-kit generate` can be used again.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Bilai is a Next.js 16 (App Router, React 19) web app connecting cat adopters and rehomers in Bangladesh. Auth via better-auth (email/password + Google), data in Postgres (Neon) via Drizzle ORM, styling via Tailwind v4 + shadcn (`base-nova` style).

## Commands

```bash
npm run dev           # next dev (turbopack, cacheComponents + partialPrefetching on)
npm run build
npm run start
npm run lint          # eslint
npm run test          # vitest run (lib/*.test.ts)
npm run photos:sync   # tsx scripts/sync-photos.ts — see "Photo storage" below
```

There are two test runners in this repo:
- `npm run test` (vitest) runs `lib/*.test.ts`, e.g. `lib/phone.test.ts`.
- `tests/*.test.mjs` runs under Node's built-in test runner (`node --test tests/delete-listing.test.mjs`), not vitest. These tests transpile a single `.ts`/`.tsx` file in isolation with the TypeScript compiler and execute it in a `vm` context with hand-written mocks for `@/db`, `@/lib/auth`, `next/navigation`, etc. (see `tests/delete-listing.test.mjs`). Follow that pattern for new tests that need to exercise a server action or component without a real DB/Next runtime.

No single-test-file flag is configured for vitest beyond passing a path, e.g. `npx vitest run lib/phone.test.ts`.

Drizzle migrations: `npx drizzle-kit generate` to create a migration from schema changes, `npx drizzle-kit migrate` (or run the SQL in `drizzle/`) to apply. Config in `drizzle.config.ts`; schema lives in `db/schema.ts` (and `auth-schema.ts`, which better-auth reads from).

## Architecture

**Route structure**: Pages live under `app/(pages)/*` (route group, no URL segment) — `add_a_cat`, `auth`, `find_a_cat`, `find_a_cat/[id]`, `profile`, `profile/edit`. API routes are thin: `app/api/auth/[...all]/route.ts` delegates entirely to better-auth; `app/uploads/[...path]/route.ts` serves photo bytes.

**Server actions, not API routes**: Mutations (`add_a_cat/actions.ts`, `find_a_cat/[id]/delete-actions.ts`, `profile/edit/actions.ts`) are `"use server"` functions colocated with their page, returning `{ ok: true } | { ok: false; error: string }` rather than throwing for expected validation failures. Every action re-derives the session user server-side via `getSession()` (`lib/auth.ts`) and re-validates everything the client already checked — never trust client-side validation alone.

**Data access layer**: `lib/cats.ts` and `lib/contact.ts` are the only places that query `cats`/`catImages`/`user` for reads; both are `import "server-only"`. Keep read logic there rather than inlining queries in pages/actions, and never select the phone number into anything rendered on a page — `getCatContact`/contact actions fetch it separately and only hand it to the client on an explicit tap (see comments in `lib/contact.ts`).

**Listing lifecycle**: Listings self-expire 7 days after creation (`lib/listing-expiry.ts`, `LISTING_LIFETIME_DAYS`). `isLiveListing`/`isExpiredListing`/`listingSecondsLeft` are raw SQL computed against the DB's `now()` so every server instance agrees; all reads in `lib/cats.ts` filter by `isLiveListing`. Expired listings are purged lazily: `purgeExpiredListings()` is invoked via `after()` on busy mutation paths (e.g. end of `submitForm`), throttled per server instance to once every 10 minutes (`PURGE_EVERY_MS`), not run on every request or via a cron job.

**Photo storage**: Image bytes are stored as base64 in the `cat_images.data` column (Neon HTTP driver, so no separate blob store) — see the "Listing photos" section of `README.md`. `uploads/` on disk is a legacy/local fallback and a git-tracked export, not the source of truth for new uploads. `scripts/sync-photos.ts` reconciles the two directions (imports old local files into the DB; exports DB photos back to `uploads/` for a GitHub snapshot) and must be run on each machine that previously accepted local uploads. `app/uploads/[...path]/route.ts` and `lib/uploads.ts`'s `removeLocalPhotos` both resolve the requested path and verify it stays inside `UPLOAD_ROOT` and ends in `.webp` before touching the filesystem — preserve that check in any code that touches upload paths, it's the path-traversal guard. Uploaded images are always normalized server-side to WebP, long edge ≤1600px (`lib/compress-image.ts`, limits in `lib/cat-limits.ts`); `isWebp()` (`lib/uploads.ts`) magic-byte-checks every buffer before it's trusted as an image.

**Phone numbers**: Stored normalized (`8801712345678`, no `+`) via `normalizeBdPhone()` (`lib/phone.ts`), handed to the UI as `+8801712345678` (`getUserPhone` in `lib/contact.ts`), and stripped back to bare digits for `wa.me` links (`buildContactUrl`). Phone is required at email sign-up (enforced in a better-auth `databaseHooks.user.create.before` hook in `lib/auth.ts`) but optional at Google sign-up — Google users are prompted for it the first time they list a cat (`add_a_cat/actions.ts`). Uniqueness is enforced both at the DB level (`user.phone` is `unique()`) and defensively in application code before writes.

**Filters**: `lib/cat-filters.ts` defines the `CatFilters` shape shared between the search UI (`components/view/search/CatFilters.tsx`) and `getCats()` in `lib/cats.ts`, which builds the Drizzle `and()/or()` query dynamically from whichever filters are set.

**Rendering model**: `cacheComponents` + `partialPrefetching` are on (`next.config.ts`). Per the comment in `lib/cats.ts`, catalog reads are deliberately left uncached and rendered under `Suspense` so each navigation gets fresh data — don't wrap these reads in `"use cache"` without checking whether staleness is acceptable for that view.

**Path alias**: `@/*` maps to the repo root (`tsconfig.json`); shadcn aliases in `components.json` (`@/components`, `@/components/ui`, `@/lib`) — use these instead of relative imports.

## Notes

- `AGENTS.md` in the repo root is auto-managed by `next dev` (regenerated/restored on every dev run) — don't treat it as hand-authored project instructions.
- `next.config.ts` has `agentUpgrade: "security"` and `agentFeedback: true` set, and `next dev` may rewrite `AGENTS.md` accordingly; see its own content for current guidance when it's present.

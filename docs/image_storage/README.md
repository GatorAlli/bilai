# Bilai listing photo storage

Follow a cat photo from the file picker to PostgreSQL, back to a visitor's browser, and through deletion or expiry. The lessons assume you can read TypeScript and use forms, Server Actions, and basic Drizzle queries. They start from scratch with image bytes, WebP, and base64.

```text
Upload    File → decoded pixels → WebP File → FormData → Buffer → base64 in Postgres
View      listing page → photo URL → GET /uploads/... → WebP bytes → browser
Cleanup   owner delete or expiry → listing row deleted → photo rows cascade
                                                          ↳ local copies removed if present
```

## Start here

1. [Follow the tutorial](tutorial.md). Each lesson gives you a small example and something to try.
2. [Read the source reference](source_reference.md) alongside the lessons. It reproduces the complete storage modules and the relevant lines from shared files, with links to the originals.
3. [Take the quiz](quiz.md). Predict what the code will do before opening the answer key.

## Try it locally

If you already have a development checkout, start it with `npm run dev`. Otherwise install the locked dependencies with `npm ci` and configure the app with a development database, auth settings, and the other credentials needed by your checkout. The database needs the existing Bilai schema and the shared photo storage migration. That migration adds a column to an existing table. Use a provisioned development database for the exercises. [Project setup](../../README.md) · [Ably setup](../chat/ably_setup.md) · [Photo migration](../../drizzle/20261111020000_shared_photo_storage/migration.sql)

1. Open `/add_a_cat`, sign in, and select two sample photos you can use for testing. Add different captions and move the second photo above the first.
2. Save the listing. Find it on your profile and check that the new first photo is the cover. Open the listing and check that both captions stayed with their photos.
3. Open the browser's **Network** panel and reload the listing. Select a `/uploads/…webp` request and inspect its URL, status, and response headers. Keep the URL for the serving and cleanup lessons.

For the existing automated checks, run `npm run test`. Use `node --test tests/delete-listing.test.mjs` to focus on owner deletion. Those tests use simulated database and filesystem calls. The browser exercise lets you observe the file picker, compression and photo delivery together.

[All project docs](../README.md)

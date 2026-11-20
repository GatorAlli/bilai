# Listing photo storage (Cloudflare R2)

Listing photos are stored in a Cloudflare R2 bucket. Browsers load them straight from the bucket's public domain, so after upload neither the app server nor Postgres handles the image bytes.

```text
Upload    picker → WebP in the browser → submitForm → cats row → PutObject cats/<publicId>-<n>.webp → cat_images rows
View      page → catPhotoUrl(key) = R2_PUBLIC_URL/<key> → Cloudflare CDN → <img>
Cleanup   owner delete or expiry → rows deleted (cascade) → DeleteObjects for the listing's keys
```

## Listing ids and photo keys

Every listing has a random 8-character `public_id` of lowercase letters and digits (`gj34jfxk`, from `newPublicId` in `lib/public-id.ts`). It is used in:

- the listing URL: `/find_a_cat/gj34jfxk`. Old numeric URLs (`/find_a_cat/3`) redirect to it.
- the photo keys: `cats/gj34jfxk-1.webp` … `cats/gj34jfxk-5.webp`, numbered in display order (`catPhotoKey` in `lib/uploads.ts`).

The sequential `cats.id` never leaves the server. Server actions and client components take the public id, and validate it with `isPublicId` before querying.

Postgres stores only the key, caption and position of each photo (`cat_images`). The URL is built at read time by `catPhotoUrl(key)`, so changing the public domain never requires a data migration.

## Code map

| Step              | Where                                                                           | What happens                                                                                                                                                                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prepare           | `lib/compress-image.ts`, `app/(pages)/add_a_cat/ImageGallery.tsx`               | The browser converts each picked photo to WebP, with a long edge ≤1600px and a 1 MiB target. Limits are in `lib/cat-limits.ts`.                                                                                                                                                                                                   |
| Validate + upload | `app/(pages)/add_a_cat/actions.ts` (`submitForm`)                               | Rechecks count, size and the WebP header (`isWebp`). Inserts the `cats` row first, so its unique `public_id` claims the keys and a collision can't overwrite another listing's photos. Then calls `putCatPhoto` for each photo and inserts the `cat_images` rows. If anything fails, it deletes the row and the uploaded objects. |
| Read              | `lib/cats.ts`                                                                   | Queries select the cover or photo **keys** and map them through `catPhotoUrl`. Components receive `coverImageUrl` / `images[].url`.                                                                                                                                                                                               |
| Display           | `components/view/cat/CatCard.tsx`, `app/(pages)/find_a_cat/[publicId]/page.tsx` | `<Image unoptimized>`, so the browser requests the R2 URL directly (no `remotePatterns` needed).                                                                                                                                                                                                                                  |
| Delete            | `app/(pages)/find_a_cat/[publicId]/delete-actions.ts`                           | Owner-checked row delete, then `deleteCatPhotos` for keys under that listing's own `cats/<publicId>-` prefix only.                                                                                                                                                                                                                |
| Expire            | `lib/listing-expiry.ts` (`purgeExpiredListings`)                                | Deletes listings older than 3 months, then their R2 objects. Runs lazily via `after()`, at most every 10 minutes per server.                                                                                                                                                                                                      |
| R2 client         | `lib/cloudflareR2.ts`                                                           | S3 client, `putCatPhoto` (sets `image/webp` and `immutable` caching) and `deleteCatPhotos` (batched, best-effort: it logs errors and never throws).                                                                                                                                                                               |

## Setup

### 1. Cloudflare dashboard

1. **R2 → Create bucket.** Any name. Use the default location.
2. **R2 → Manage API tokens → Create API token.** Choose _Object Read & Write_, limited to this bucket. Copy the Access Key ID, the Secret Access Key and the S3 endpoint (`https://<account-id>.r2.cloudflarestorage.com`).
3. **Bucket → Settings → Public access.**
   - **Testing / local dev:** enable the _Public Development URL_ (`https://pub-<hash>.r2.dev`). It is rate-limited and not meant for production.
   - **Production:** _Custom Domains → Connect Domain_, e.g. `img.example.com`. The domain's DNS zone must be on Cloudflare. Once it's connected, you can disable the r2.dev URL.
   - No CORS rule is needed. Photos are loaded by `<img>`, not `fetch`.

### 2. Environment variables

```bash
CLOUDFLARE_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
CLOUDFLARE_R2_BUCKET=<bucket name>
R2_PUBLIC_URL=https://pub-<hash>.r2.dev   # or https://img.example.com in production
```

### 3. Database

Apply `drizzle/20261120000000_cats_public_id/migration.sql` (adds and backfills `cats.public_id`) and then `drizzle/20261120010000_drop_cat_images_legacy/migration.sql` (drops the old `data` and `url` columns). Run the second one only once every photo is in R2. Earlier migrations in this repo were applied by hand (there is no Drizzle journal table), so run these files directly rather than `drizzle-kit migrate`, which would replay them all.

### 4. Check it works

```bash
npm run r2:check
```

The check uploads a 1×1 WebP and fetches it from `R2_PUBLIC_URL`, checking the status, `image/webp`, the `immutable` cache header and the bytes. It then deletes the object and confirms the URL returns 404. Run it again after switching `R2_PUBLIC_URL` to the custom domain.

Then in the app (`npm run dev`):

1. Create a listing with a few photos. The bucket shows `cats/<publicId>-1.webp` and onwards, and the card links to `/find_a_cat/<publicId>`.
2. In the browser's **Network** panel, the photos load from `R2_PUBLIC_URL` with `image/webp` and a `public, max-age=31536000, immutable` cache header.
3. Delete the listing. The objects disappear from the bucket.

Automated tests: `npm run test`. `lib/public-id.test.ts` and `lib/uploads.test.ts` cover the ids, keys and URLs. `tests/delete-listing.test.mjs` checks that delete only removes the owner's own listing and only that listing's R2 keys.

## History

Before R2, photo bytes were stored as base64 in `cat_images.data` and served by an `/uploads/...` route. In November 2026 a one-off script moved every photo into R2 under the new keys and checked each copy byte for byte. Migration `20261120010000_drop_cat_images_legacy` then dropped the `data` and `url` columns, and the route was removed.

## Things to keep in mind

- **Never reuse or overwrite a key.** Objects are cached as `immutable` for a year. If photo editing is added, give a replaced photo a new key (e.g. a version suffix).
- **Expired photos linger briefly.** A listing is hidden from every page the moment it expires, but its photos stay reachable at their URLs until the next purge deletes them. A copy cached on the CDN can also outlive a delete for a short while.
- **Upload size.** Photos pass through the `submitForm` Server Action (`bodySizeLimit` is 20 MB in `next.config.ts`). A host with a lower request cap (Vercel: about 4.5 MB) would need presigned PUT uploads straight from the browser to R2.
- **Secrets stay on the server.** `lib/cloudflareR2.ts` holds the R2 secret key. Import it only from server code (server actions, `lib/*` server modules, scripts).

New to this system? [The image storage guide](guide.md) teaches S3 and R2 from scratch and walks through every line of this code.

[All project docs](../README.md)

# Bilai Image Storage Guide

**Learn how Bilai stores, serves and deletes cat photos with Cloudflare R2 and the Amazon S3 API.**

This guide walks through every line of code in the image storage system. When you finish it you should be able to change, debug and extend the system without help.

> **How to read this guide:** the chapters follow the journey of one photo, from the moment a user picks it to the moment it is deleted. Every code box is copied straight from the repository, so you can open the same file next to the guide and follow along. Line numbers in the text refer to the file's own line numbers, as of commit `b5ba96e`. If the code has moved on since then, search for the nearby text instead.

---

## Table of contents

**Part 1 - Foundations**

1. [The big picture](#chapter-1-the-big-picture)
2. [Amazon S3 and Cloudflare R2](#chapter-2-amazon-s3-and-cloudflare-r2)
3. [Web concepts you will meet](#chapter-3-web-concepts-you-will-meet)

**Part 2 - Building blocks**

4. [Configuration and environment variables](#chapter-4-configuration-and-environment-variables)
5. [Limits: `lib/cat-limits.ts`](#chapter-5-limits-libcat-limitsts)
6. [Ids and keys: `lib/public-id.ts` and `lib/uploads.ts`](#chapter-6-ids-and-keys)
7. [The R2 client: `lib/cloudflareR2.ts`](#chapter-7-the-r2-client-libcloudflarer2ts)
8. [The database tables and migrations](#chapter-8-the-database-tables-and-migrations)

**Part 3 - The upload path**

9. [Compressing in the browser: `lib/compress-image.ts`](#chapter-9-compressing-in-the-browser)
10. [The photo picker: `ImageGallery.tsx`](#chapter-10-the-photo-picker-imagegallerytsx)
11. [Sending the form: `ListACat.tsx`](#chapter-11-sending-the-form-listacattsx)
12. [The server action: `submitForm`](#chapter-12-the-server-action-submitform)

**Part 4 - Reading, deleting, expiring**

13. [Showing photos](#chapter-13-showing-photos)
14. [Deleting a listing](#chapter-14-deleting-a-listing)
15. [Expiring old listings](#chapter-15-expiring-old-listings)

**Part 5 - Operating the system**

16. [Setup and the `r2:check` script](#chapter-16-setup-and-the-r2check-script)
17. [The tests](#chapter-17-the-tests)
18. [What can go wrong](#chapter-18-what-can-go-wrong)
19. [Recipes: changing the system](#chapter-19-recipes-changing-the-system)
20. [Glossary and cheat sheet](#chapter-20-glossary-and-cheat-sheet)

Every chapter ends with a **quiz**. Answers are hidden under a "Show answers" line so you can test yourself first.

---

# Chapter 1: The big picture

## What the system does

Bilai lets people list cats for adoption. Each listing has up to **5 photos**. This system:

1. Shrinks each photo in the user's browser and turns it into a WebP file.
2. Sends the photos to the server together with the rest of the form.
3. Checks the photos again on the server and uploads them to **Cloudflare R2**.
4. Remembers where each photo is in Postgres (just a short text _key_, not the picture).
5. Shows the photos by pointing the browser's `<img>` tag straight at R2's public address.
6. Deletes the photos from R2 when a listing is deleted or expires.

The most important idea: **the image bytes never live in Postgres, and after the upload the app server never touches them again.** Postgres holds a tiny pointer. R2 holds the picture. The browser fetches the picture from Cloudflare directly.

## The three flows

```text
UPLOAD    pick photo → browser makes WebP → submitForm (server action)
          → insert cats row → PutObject cats/<publicId>-<n>.webp → insert cat_images rows

VIEW      page query → key from cat_images → catPhotoUrl(key) = R2_PUBLIC_URL + "/" + key
          → <img src="https://…/cats/gj34jfxk-1.webp"> → Cloudflare CDN → R2

CLEANUP   owner deletes (or listing expires) → cats row deleted (photo rows cascade)
          → DeleteObjects for that listing's keys
```

## Who talks to whom

```text
 ┌──────────────┐  1. form + WebP files   ┌───────────────────┐
 │   Browser    │ ──────────────────────► │  Next.js server   │
 │  (React UI)  │                         │  (submitForm)     │
 └──────┬───────┘                         └───┬───────────┬───┘
        │                                     │           │
        │ 3. <img src=public URL>             │ 2a. rows  │ 2b. PutObject /
        │    (reads photo)                    ▼           ▼     DeleteObjects
        │                              ┌───────────┐  ┌─────────────────┐
        └────────────────────────────► │ Postgres  │  │ Cloudflare R2   │
          (via the Cloudflare CDN)     │ (keys)    │  │ (the photos)    │
                                       └───────────┘  └─────────────────┘
```

Notice that the browser talks to R2 only to **read**. All **writes** (upload and delete) go through the server, because writing needs a secret key that must never be sent to a browser.

## Every file in the system

| File                                                                            | Runs where        | Job                                                          |
| ------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------ |
| `lib/cat-limits.ts`                                                             | browser + server  | Shared numbers: max photos, max sizes, accepted file types   |
| `lib/compress-image.ts`                                                         | browser           | Resize and convert a picked photo to WebP                    |
| `app/(pages)/add_a_cat/ImageGallery.tsx`                                        | browser           | Photo picker, drag-and-drop, reorder, captions               |
| `app/(pages)/add_a_cat/ListACat.tsx`                                            | browser           | The listing form; puts the photos into `FormData`            |
| `app/(pages)/add_a_cat/actions.ts`                                              | server            | `submitForm`: validates, inserts the listing, uploads photos |
| `lib/public-id.ts`                                                              | server (and test) | Random 8-character listing ids                               |
| `lib/uploads.ts`                                                                | server (and test) | Build/validate photo keys and URLs; check the WebP header    |
| `lib/cloudflareR2.ts`                                                           | server only       | The S3 client; `putCatPhoto`, `deleteCatPhotos`              |
| `db/schema.ts` (`catImages`) + `drizzle/*`                                      | server            | The `cat_images` table and its migrations                    |
| `lib/cats.ts`                                                                   | server only       | Reads: turns stored keys into public URLs                    |
| `components/view/cat/CatCard.tsx`, `find_a_cat/[publicId]/page.tsx`             | server            | Show the photos                                              |
| `app/(pages)/find_a_cat/[publicId]/delete-actions.ts`                           | server            | Owner deletes a listing and its photos                       |
| `lib/listing-expiry.ts`                                                         | server only       | Deletes listings older than 3 months and their photos        |
| `scripts/check-r2.ts`                                                           | your terminal     | Smoke test: upload, read, delete                             |
| `next.config.ts`                                                                | build/runtime     | Raises the server-action body limit to 20 MB                 |
| `lib/uploads.test.ts`, `lib/public-id.test.ts`, `tests/delete-listing.test.mjs` | tests             | Automated checks                                             |

> **Tip:** "server only" means the file imports `"server-only"` or holds a secret, so it must never be imported by a browser component. You will see why in Chapter 7.

## Chapter 1 quiz

1. Where are the actual photo bytes stored after an upload?
2. What does Postgres store for each photo?
3. Why does the browser only _read_ from R2 and never _write_?
4. Name the three flows in the system.

<details>
<summary>Show answers</summary>

1. In the Cloudflare R2 bucket.
2. The photo's **key** (e.g. `cats/gj34jfxk-1.webp`), its caption and its position. Not the image.
3. Writing needs the R2 secret key. Anything sent to a browser is visible to the user, so writes are done by the server.
4. Upload, view, cleanup.

</details>

---

# Chapter 2: Amazon S3 and Cloudflare R2

This is the chapter that explains the "stack" part of the system. Take your time with it: the rest of the guide keeps using these words.

## 2.1 What is object storage?

A normal computer stores files in **folders** on a disk. **Object storage** is different. It is a giant labelled warehouse you reach over the internet. You hand it a blob of bytes and a label, and later you ask for the blob back by its label. That is all.

Amazon built the first popular one, **S3** (_Simple Storage Service_), in 2006. It was so successful that its HTTP API became a standard that other companies copy. **Cloudflare R2** is one of them: it speaks the **S3 API**, so Amazon's own JavaScript library works with it. That is why this project imports `@aws-sdk/client-s3` even though no Amazon server is involved.

> **Why R2 instead of S3?** R2 does not charge for data leaving the bucket (_egress_), and it sits behind Cloudflare's CDN. For a photo site that is mostly _reads_, that matters. You do not need to know prices to work on this system.

## 2.2 The vocabulary

| Word           | Meaning                                                                                   | In Bilai                                                      |
| -------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Bucket**     | A named container for objects. The top-level thing you create in the dashboard.           | `CLOUDFLARE_R2_BUCKET`                                        |
| **Object**     | One stored item: the bytes plus its metadata.                                             | One WebP photo                                                |
| **Key**        | The object's unique name inside the bucket.                                               | `cats/gj34jfxk-1.webp`                                        |
| **Metadata**   | Extra facts stored with the object, such as `Content-Type` and `Cache-Control`.           | `image/webp` and `public, max-age=31536000, immutable`        |
| **Endpoint**   | The web address of the storage API (where the SDK sends its requests).                    | `https://<account-id>.r2.cloudflarestorage.com`               |
| **Region**     | Which data-centre area a bucket lives in. S3 requires one; R2 has just one logical place. | `"auto"`                                                      |
| **Access key** | The "username" for the API: an _Access Key ID_ plus a _Secret Access Key_.                | `CLOUDFLARE_R2_ACCESS_KEY`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY` |
| **Public URL** | A separate address that lets anyone _read_ objects over plain HTTP, with no credentials.  | `R2_PUBLIC_URL`                                               |

## 2.3 Keys look like folders, but there are no folders

The key `cats/gj34jfxk-1.webp` _looks_ like a file called `gj34jfxk-1.webp` inside a folder called `cats`. It is not. The bucket is **flat**: the whole string `cats/gj34jfxk-1.webp` is the key, slashes included. The dashboard and tools just _pretend_ the part before a slash is a folder, and call that part a **prefix**.

Why this matters in Bilai:

- There is no "create folder" step. Uploading to `cats/x.webp` just works.
- "Delete the folder" does not exist. You delete keys one by one (or in a batch). That is why `deleteCatPhotos` takes a list of keys.
- The delete code checks `key.startsWith("cats/gj34jfxk-")`, a **prefix check**, to make sure a delete never touches another listing's photos.

## 2.4 Two doors into the same bucket

This is the single most important idea for working with R2. The same bucket has **two completely separate ways in**:

```text
                      ┌──────────────────────────┐
  Door 1: S3 API      │                          │      Door 2: public domain
  (private, signed)   │      R2 bucket           │      (public, read-only)
                      │   cats/gj34jfxk-1.webp   │
  your server  ─────► │   cats/gj34jfxk-2.webp   │ ◄───── anyone's browser
  PutObject           │   …                      │        GET https://img.example.com/cats/…
  DeleteObjects       └──────────────────────────┘
  needs secret key                                        needs nothing
  endpoint: <account>.r2.cloudflarestorage.com            URL: R2_PUBLIC_URL
```

| Door 1: S3 API endpoint                              | Door 2: public domain                                                |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| `CLOUDFLARE_R2_ENDPOINT`                             | `R2_PUBLIC_URL`                                                      |
| Used by the server (`lib/cloudflareR2.ts`)           | Used by browsers (`<img src>`) and by `catPhotoUrl`                  |
| Can write, delete, list                              | Can only read (`GET`)                                                |
| Every request must be **signed** with the secret key | No signature; anyone with the URL can fetch the object               |
| Not cached                                           | Served through Cloudflare's CDN, so photos are cached close to users |

You turn Door 2 on in the Cloudflare dashboard, in one of two ways:

- **Public Development URL** (`https://pub-<hash>.r2.dev`): for testing. Rate-limited, not for production.
- **Custom Domain** (`https://img.example.com`): for production. The domain must be on Cloudflare DNS.

> **Mixing them up is the #1 beginner mistake.** If you put the S3 endpoint in `R2_PUBLIC_URL`, browsers get `403`/`400` errors. If you put the public domain in `CLOUDFLARE_R2_ENDPOINT`, uploads fail. They look similar but are different things.

> **Note:** a public bucket cannot be listed by visitors. Someone can only fetch an object if they already know its exact key. Bilai's keys contain a random 8-character id, so they cannot be guessed. But these photos are meant to be public anyway; do not treat key secrecy as a security feature for anything private.

## 2.5 How the S3 API authenticates: signing

When your server calls the S3 API it does **not** send the secret key. Instead, the SDK uses it to compute a **signature** (a long hash) over the request details and attaches the signature. The server recomputes the same hash with its copy of the secret and compares. This scheme is called **Signature Version 4 (SigV4)**.

Two consequences:

- The secret never travels over the network.
- The signing process includes a **region** name. S3 needs a real one (`us-east-1`). R2 has no regions for this purpose, so it asks you to say `"auto"`. That is why `lib/cloudflareR2.ts` has `region: "auto"`.

You never write signing code. The SDK does it for you every time you call `s3.send(...)`.

## 2.6 The AWS SDK v3 pattern: client + command

The SDK (`@aws-sdk/client-s3`, installed version 3.1173.0) has one shape for everything:

```ts
const client = new S3Client({/* where and who */}); // 1. make a client once
const result = await client.send(new SomeCommand({/* what */})); // 2. send commands to it
```

- **`S3Client`** knows _where_ the storage is (endpoint, region) and _who you are_ (credentials).
- A **Command** class describes _one operation_ and its inputs. There is one class per S3 operation.
- **`client.send(command)`** performs the operation and returns a Promise.

Bilai uses exactly two commands:

| Command                | S3 operation    | What it does                               | Notes                                                                                                  |
| ---------------------- | --------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `PutObjectCommand`     | `PutObject`     | Stores one object under a key              | If the key already exists it is **silently overwritten**. There is no "already exists" error.          |
| `DeleteObjectsCommand` | `DeleteObjects` | Deletes up to **1000** keys in one request | `Quiet: true` means "only tell me about failures". Deleting a key that does not exist is not an error. |

> **Remember:** "PutObject overwrites silently" is the reason Bilai puts so much effort into making keys unique (Chapter 6 and Chapter 12).

## 2.7 Metadata: Content-Type and Cache-Control

When you `PutObject` you can attach metadata that is stored with the object and **sent back as HTTP headers whenever the object is read**. Bilai sets two:

- **`ContentType: "image/webp"`**: tells browsers "this is a WebP image". Without it the object would be served as a generic binary type (`binary/octet-stream`) and browsers may refuse to show it as an image.
- **`CacheControl: "public, max-age=31536000, immutable"`**: tells browsers and the CDN how long they may keep a copy. Chapter 3 explains it.

## 2.8 Checksums (one odd line of config)

Newer versions of the AWS SDK automatically add a checksum to uploads and verify one on downloads. R2 is not always happy with the new defaults, so Cloudflare recommends telling the SDK to do it **only when an operation requires it** (`"WHEN_REQUIRED"`). You will see this in `lib/cloudflareR2.ts`. If you ever upgrade the SDK and uploads start failing with checksum errors, look at those two settings first.

## Chapter 2 quiz

1. Is a bucket a folder? What is a key?
2. `cats/gj34jfxk-1.webp`: what is `cats/` called?
3. What are the two doors into an R2 bucket, and which one does the browser use?
4. Why is `region: "auto"` in the client config?
5. You `PutObject` a key that already exists. What happens?
6. What does `Quiet: true` do in `DeleteObjects`?
7. Why do we set `ContentType` when uploading?

<details>
<summary>Show answers</summary>

1. No. A bucket is a flat container. A key is an object's unique name in it; slashes are just characters.
2. A **prefix** (it behaves like a folder name in tools, but it is part of the key).
3. The S3 API endpoint (server, signed, can write) and the public domain (anyone, read only). The browser uses the public domain.
4. S3's signing needs a region name. R2 has no real regions, and `"auto"` is the value R2 expects.
5. It is silently overwritten.
6. The response lists only the keys that failed to delete (in `Errors`), instead of listing every success.
7. So the public URL serves `Content-Type: image/webp` and browsers treat it as an image.

</details>

---

# Chapter 3: Web concepts you will meet

Several ideas in the code are not specific to R2 but are easy to trip on. This chapter teaches them once, so the later chapters can move quickly.

## 3.1 HTTP caching headers

When a browser downloads a photo, the response carries headers. Two of them control caching.

```text
Content-Type: image/webp
Cache-Control: public, max-age=31536000, immutable
```

| Part               | Meaning                                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `public`           | Any cache may keep it, including shared ones like a CDN (not just the user's own browser).                       |
| `max-age=31536000` | Treat the copy as fresh for 31,536,000 seconds = 60 × 60 × 24 × 365 = **one year**.                              |
| `immutable`        | "This file will never change at this URL." The browser will not even re-check it when the user reloads the page. |

**The catch:** caches are keyed by **URL**. If you upload a _different_ picture to the _same_ key, people who already have the old copy keep seeing it for up to a year. That is why Bilai has a rule: **never reuse or overwrite a key.** If photo editing is ever added, a replaced photo needs a new key.

## 3.2 What is a CDN?

A **CDN** (_Content Delivery Network_) is a set of servers around the world that keep copies of popular files. A user in Dhaka is served a nearby copy instead of fetching from the bucket's home every time.

- R2's public domain is fronted by Cloudflare's CDN.
- The first request for a photo goes to the bucket (a _cache miss_) and the CDN keeps a copy.
- Later requests are served from the edge (a _cache hit_), fast and cheap.
- Because `Cache-Control` says `public`, the CDN is allowed to keep it.

Consequence for deletes: after you delete an object from R2, a CDN copy may keep serving for a short while. The docs call this out ("A copy cached on the CDN can also outlive a delete").

## 3.3 Binary data in JavaScript

Photos are _binary_ data, not text. JavaScript has several types for it. The code uses four, so learn how they relate:

| Type          | Where it lives     | What it is                                                                                               |
| ------------- | ------------------ | -------------------------------------------------------------------------------------------------------- |
| `Blob`        | browser (and Node) | An immutable chunk of bytes with a MIME `type` (e.g. `"image/webp"`).                                    |
| `File`        | browser (and Node) | A `Blob` that also has a `name` and `lastModified`. What `<input type="file">` gives you.                |
| `ArrayBuffer` | everywhere         | A raw, fixed-length block of memory. You usually cannot read it directly.                                |
| `Buffer`      | **Node.js only**   | A convenient byte array for servers. Has helpers like `toString("ascii", 0, 4)`. The AWS SDK accepts it. |

Conversions you will see:

```ts
const arrayBuffer = await file.arrayBuffer(); // File/Blob → ArrayBuffer (async)
const buf = Buffer.from(arrayBuffer); // ArrayBuffer → Buffer (Node)
const file2 = new File([blob], "x.webp", { type: "image/webp" }); // Blob → File
```

`file.arrayBuffer()` returns a **Promise**, so it needs `await`.

## 3.4 FormData and multipart uploads

`FormData` is the browser's built-in way to bundle form fields **and files** into one request.

```ts
const formData = new FormData();
formData.set("name", "Mimi"); // one value; replaces any earlier "name"
formData.append("images", fileA); // add a value; keeps earlier ones with the same key
formData.append("images", fileB);
formData.getAll("images"); // → [fileA, fileB]  (a list, in order)
```

- `set` replaces; `append` adds. Bilai uses `append` for photos so there can be several `images` entries.
- Entries are stored in the order you append them. That is how the server learns the photo order.
- When it travels over the network, it is sent as `multipart/form-data`. Next.js decodes it for you into a `FormData` inside the server action.
- Each entry is either a `string` or a `File`. `formData.getAll("images")` has the type `(string | File)[]`, so the server filters to `File`.

## 3.5 TypeScript type guards

A **type guard** is a function whose return type tells TypeScript something about its argument:

```ts
function isPublicId(value: unknown): value is string {
  /* returns true/false */
}
```

`value is string` means: "if this returns `true`, TypeScript, treat `value` as a `string` from now on." Bilai uses one inline too:

```ts
.filter((v): v is File => v instanceof File)
```

Without the `v is File` part, `.filter(...)` would still return `(string | File)[]`.

## 3.6 Regular expressions in this code

A **regex** describes a text pattern. The ones in Bilai:

```text
/^[a-z0-9]{8}$/
```

| Piece      | Meaning                                      |
| ---------- | -------------------------------------------- |
| `^`        | Start of the string                          |
| `[a-z0-9]` | One character: a lowercase letter or a digit |
| `{8}`      | Exactly 8 of the previous thing              |
| `$`        | End of the string                            |

The `^` and `$` **anchors** matter for security: without them, `"../../gj34jfxk"` would match because `gj34jfxk` appears _somewhere_ inside it.

`.test(string)` returns `true` or `false`. `new RegExp(text)` builds a regex from a string. When you write a backslash inside a normal JS string you must double it (`"\\."`) so the string contains one backslash, which the regex then reads as "a literal dot".

## 3.7 Magic bytes (file signatures)

A file's extension and `Content-Type` are claims a user can fake. The first bytes of the file itself are harder to fake. A WebP file always begins like this:

```text
bytes 0-3   "RIFF"
bytes 4-7   file size (4 bytes of binary)
bytes 8-11  "WEBP"
```

`isWebp` in `lib/uploads.ts` checks those 12 bytes. It is a sanity check, not a full validation: it does not prove the rest of the file is a valid image.

## 3.8 Object URLs

In the photo picker, the user's chosen file is not uploaded yet, but we want to show a preview. `URL.createObjectURL(file)` makes a temporary address like `blob:http://localhost:3000/6f1c…` that the browser can show in an `<img>`. It points at memory, so it must be released later with `URL.revokeObjectURL(url)` or it leaks memory.

## 3.9 `after()` and `redirect()` in Next.js

Two Next.js functions appear in the server action. Both are documented in `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/`.

- **`after(callback)`** (from `next/server`) schedules work to run **after the response has been sent**, so it does not slow the user down. The docs note it still runs even if the response ends in a `redirect()` or an error.
- **`redirect(path)`** (from `next/navigation`) sends the user to another page. In a server action it works by **throwing a special error** that Next.js catches. So if you call it inside a `try { } catch { }`, your own `catch` would catch it and swallow it. The code keeps `redirect` outside the `try`.

## 3.10 `next/image` and `unoptimized`

By default the `<Image>` component does not load your URL directly. The browser asks Next.js (`/_next/image?url=…`), and the Next server downloads, resizes and re-encodes the image. For remote images you must list their host in `images.remotePatterns`.

Bilai passes **`unoptimized`**. Per the Next.js docs, that means "the source image will be served as-is from the `src`". The browser requests the R2 URL itself, which is exactly what we want: Cloudflare's CDN serves the file, and the Next server stays out of it. It also means no `remotePatterns` config is needed.

## Chapter 3 quiz

1. What does `immutable` promise?
2. Why must a photo's key never be reused?
3. What is the difference between `Blob`, `File` and `Buffer`?
4. `formData.set("a", 1)` twice vs `formData.append("a", 1)` twice: what does `getAll("a")` return in each case?
5. What does `value is string` in a function's return type do?
6. Why do the regexes start with `^` and end with `$`?
7. What are the first 12 bytes of a WebP file checked for?
8. Why does `redirect()` sit outside the `try/catch` in the server action?
9. With `unoptimized`, who requests the image from R2?

<details>
<summary>Show answers</summary>

1. That the file at this URL will never change, so caches need not re-check it.
2. Caches key on the URL and may hold the old copy for a year, so new content under an old key would not show up.
3. `Blob` is bytes with a type; `File` is a `Blob` plus a name; `Buffer` is Node's byte array, used on the server.
4. `set` twice → one value (the second). `append` twice → both values, in order.
5. It narrows the type: when the function returns `true`, TypeScript treats the argument as a `string`.
6. They force the _whole_ string to match, so values like `../x/gj34jfxk` are rejected.
7. `RIFF` at bytes 0-3 and `WEBP` at bytes 8-11.
8. `redirect()` works by throwing; a surrounding `catch` would swallow the redirect.
9. The user's browser, directly.

</details>
***

# Chapter 4: Configuration and environment variables

## 4.1 The five variables

The whole system is wired up by five environment variables in the `.env` file at the project root. That file is listed in `.gitignore` (`.env*`), so your secrets are never committed.

| Variable                          | Door (Chapter 2) | Used by                          | What it is                                               |
| --------------------------------- | ---------------- | -------------------------------- | -------------------------------------------------------- |
| `CLOUDFLARE_R2_ENDPOINT`          | Door 1 (API)     | `lib/cloudflareR2.ts`            | `https://<account-id>.r2.cloudflarestorage.com`          |
| `CLOUDFLARE_R2_ACCESS_KEY`        | Door 1 (API)     | `lib/cloudflareR2.ts`            | The Access Key ID of your R2 API token                   |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Door 1 (API)     | `lib/cloudflareR2.ts`            | The token's secret. **Never expose it.**                 |
| `CLOUDFLARE_R2_BUCKET`            | Door 1 (API)     | `lib/cloudflareR2.ts`            | The bucket's name                                        |
| `R2_PUBLIC_URL`                   | Door 2 (public)  | `lib/uploads.ts` (`catPhotoUrl`) | `https://pub-<hash>.r2.dev` or `https://img.example.com` |

Notice the naming: the four secret-ish ones are named `CLOUDFLARE_R2_...`; the public one is `R2_PUBLIC_URL`. None of them starts with `NEXT_PUBLIC_`, so Next.js **never** sends them to the browser. (Only variables starting with `NEXT_PUBLIC_` are copied into browser code.) That is deliberate: `R2_PUBLIC_URL` is only read on the server, and the finished URL is what the browser receives.

## 4.2 How each runner loads `.env`

| Runner                | How it gets the variables                                                          |
| --------------------- | ---------------------------------------------------------------------------------- |
| `npm run dev` / build | Next.js reads `.env` automatically                                                 |
| `npm run r2:check`    | `scripts/check-r2.ts` starts with `import "dotenv/config"` (loads `.env` by hand)  |
| `npm run test`        | The tests set what they need themselves (`vi.stubEnv`) or never read the variables |

## 4.3 `process.env.X!`

In TypeScript, `process.env.X` has the type `string | undefined`. Adding `!` (the **non-null assertion**) tells the compiler "trust me, it is set". The `!` exists only at compile time. If the variable is actually missing, `undefined` is passed along and you get a confusing error later, when the first request is made. Remember this when debugging: **a missing env var shows up as an odd S3 error, not as "variable missing".** (`scripts/check-r2.ts` checks for this explicitly, and `catPhotoUrl` throws a clear error for `R2_PUBLIC_URL`.)

## 4.4 `next.config.ts`

Photos reach the server through a **server action**. Next.js limits the size of that request. The default limit is **1 MB**, far too small for five photos, so the config raises it.

_next.config.ts, lines 1-22_

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    agentUpgrade: "security",
    serverActions: { bodySizeLimit: "20mb" },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
```

**Example explained**

- **Line 1** imports the `NextConfig` _type_ (`import type` is erased at build time).
- **Line 3** declares the config object and gives it that type, so the editor can autocomplete options.
- **Lines 5-9** the `experimental` block. `agentFeedback` and `agentUpgrade` are managed by Next.js tooling and are unrelated to images. **Line 8**, `serverActions: { bodySizeLimit: "20mb" }`, is the one that matters here: server actions may now receive up to 20 MB. The Next.js docs say this limit applies to the raw request body including multipart overhead.
- **Lines 10-11** `cacheComponents` and `partialPrefetching` change how pages are rendered and are covered in `AGENTS.md`.
- **Lines 12-19** `turbopack.rules` tells Turbopack to run Tailwind's loader on CSS files. Unrelated to images.
- **Line 22** exports the config so Next.js can read it.

> **Why 20 MB?** Five photos at most 1.25 MB each is about 6.25 MB, plus form fields. 20 MB leaves plenty of headroom. The catch: some hosts have their own, lower request cap (for example Vercel, about 4.5 MB), which would reject big uploads before Next.js sees them. The fix would be **presigned uploads**, where the browser sends the photo straight to R2. This guide does not cover that, because the app does not use it.

## Chapter 4 quiz

1. Which variable do browsers (indirectly) depend on, and which four does only the server use?
2. A teammate sets `CLOUDFLARE_R2_BUCKET` wrong. At what point do you find out?
3. What does `!` in `process.env.X!` do at runtime?
4. Why was `bodySizeLimit` raised?

<details>
<summary>Show answers</summary>

1. Browsers depend on `R2_PUBLIC_URL` (it is part of every photo URL). The server alone uses the four `CLOUDFLARE_R2_*` variables.
2. When the first upload or delete runs. The client is created without checking, and R2 then rejects the request (for example "bucket does not exist").
3. Nothing. It is a compile-time promise only.
4. The default 1 MB limit would reject a form with several photos.

</details>

---

# Chapter 5: Limits: `lib/cat-limits.ts`

This file holds numbers and lists shared by the browser form _and_ the server action, so both always agree. Changing a limit here changes it everywhere.

_lib/cat-limits.ts, lines 1-27_

```ts
// Shared between the client form and the server actions.
export const HEIF_IMAGE_TYPES = [
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
  ".heic",
  ".heif",
  ".heics",
  ".heifs",
] as const;
export const ACCEPTED_IMAGE_TYPES: readonly string[] = [
  "image/jpeg",
  ".jpg",
  ".jpeg",
  "image/png",
  ".png",
  "image/gif",
  ".gif",
  "image/webp",
  ".webp",
  "image/avif",
  ".avif",
  "image/bmp",
  ".bmp",
  ...HEIF_IMAGE_TYPES,
] as const;
```

**Example explained**

- **Lines 2-11** `HEIF_IMAGE_TYPES`: the MIME types and file extensions for **HEIC/HEIF**, the format iPhones use by default. Each entry is a MIME type (`"image/heic"`) or an extension (`".heic"`), because browsers sometimes report an empty MIME type for HEIC files, so the code checks both. `as const` freezes the array's type into a **tuple of exact strings** instead of `string[]`.
- **Lines 12-27** `ACCEPTED_IMAGE_TYPES`: everything the picker allows. It is typed `readonly string[]` (so `.includes(file.type)` accepts any string) and ends with `...HEIF_IMAGE_TYPES`, the **spread** operator copying every HEIF entry in.

> **Why `readonly string[]` and not the tuple?** If the array stayed a tuple of exact strings, `ACCEPTED_IMAGE_TYPES.includes(file.type)` would be a TypeScript error, because `file.type` is a plain `string`. Widening the type fixes it.

_lib/cat-limits.ts, lines 28-38_

```ts
export const MAX_IMAGES = 5;

// What the user may pick (phone photos are big); we shrink them afterwards.
export const MAX_INPUT_SIZE_MB = 25;
export const MAX_INPUT_SIZE_BYTES = MAX_INPUT_SIZE_MB * 1024 * 1024;

// What we store: always WebP, long edge <= 1600px, <= 1 MB.
export const MAX_DIMENSION = 1600;
export const TARGET_SIZE_BYTES = 1 * 1024 * 1024;
// Server accepts a little slack over the target.
export const MAX_STORED_SIZE_BYTES = Math.round(1.25 * 1024 * 1024);
```

**Example explained**

- **Line 28** `MAX_IMAGES = 5`: photos per listing. It also appears inside the key pattern in `lib/uploads.ts` (Chapter 6).
- **Lines 30-32** the **input** limit: 25 MB per picked file. Phone photos are large, so the user may pick big files; they are shrunk afterwards. `25 * 1024 * 1024` converts megabytes to bytes (1 MB = 1024 × 1024 bytes here).
- **Lines 34-36** what is **stored**: always WebP, longest side at most 1600 pixels (`MAX_DIMENSION`), at most 1 MiB (`TARGET_SIZE_BYTES`, the target the browser aims for).
- **Lines 37-38** `MAX_STORED_SIZE_BYTES = 1.25 MiB`: what the **server** accepts. It is a little above the 1 MiB target to leave slack for tiny differences between browsers' encoders. `Math.round` keeps it a whole number of bytes.

So there are **two different checks on purpose**: the browser aims for 1 MiB; the server refuses anything above 1.25 MiB.

_lib/cat-limits.ts, lines 40-46_

```ts
export const CAT_STATUSES = ["available", "pending", "adopted"] as const;
export const YES_NO_UNKNOWN = ["yes", "no", "unknown"] as const;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_TEMPERAMENT_LENGTH = 200;
export const MAX_REHOMING_REASON_LENGTH = 500;
export const CONTACT_METHODS = ["whatsapp", "call"] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];
```

**Example explained**

These are not about images. They are the allowed values for cat status, the yes/no/unknown dropdowns, text length limits and contact methods. They live in the same file because the same "shared between the client form and the server actions" idea applies. `ContactMethod` (line 46) derives a union type `"whatsapp" | "call"` from the array: `(typeof CONTACT_METHODS)[number]` means "the type of any element of that array".

## Chapter 5 quiz

1. Why do both `HEIF_IMAGE_TYPES` extensions and MIME types appear?
2. What is the difference between `TARGET_SIZE_BYTES` and `MAX_STORED_SIZE_BYTES`, and who uses each?
3. How many bytes is 25 MB in this file?

<details>
<summary>Show answers</summary>

1. Some browsers/devices report an empty or unknown MIME type for HEIC files; the extension is the fallback.
2. `TARGET_SIZE_BYTES` (1 MiB) is the goal the browser compressor aims for. `MAX_STORED_SIZE_BYTES` (1.25 MiB) is the hard limit the server enforces.
3. 25 × 1024 × 1024 = 26,214,400.

</details>

---

# Chapter 6: Ids and keys

Two small files decide **what a photo is called**. A photo's name matters more than it seems: it is the object key in R2, the address in the URL, and the thing the cache is keyed on.

## 6.1 `lib/public-id.ts`: random listing ids

Every listing gets a random 8-character id such as `gj34jfxk`. It is used in URLs (`/find_a_cat/gj34jfxk`) and in photo keys. The normal sequential `cats.id` (1, 2, 3 …) stays on the server, because sequential ids let anyone guess the next listing or photo.

_lib/public-id.ts, lines 1-21_

```ts
import { randomInt } from "node:crypto";

// Listings are addressed by a random 8-character id (`gj34jfxk`) instead of
// their sequential database id, so URLs and photo keys can't be enumerated.
// 36^8 ≈ 2.8 trillion ids; the unique constraint on cats.public_id catches the
// (very unlikely) collision.
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
export const PUBLIC_ID_LENGTH = 8;
const PUBLIC_ID_PATTERN = /^[a-z0-9]{8}$/;

export function newPublicId() {
  let id = "";
  for (let i = 0; i < PUBLIC_ID_LENGTH; i++) {
    id += ALPHABET[randomInt(ALPHABET.length)];
  }
  return id;
}

export function isPublicId(value: unknown): value is string {
  return typeof value === "string" && PUBLIC_ID_PATTERN.test(value);
}
```

**Example explained**

- **Line 1** imports `randomInt` from Node's built-in `crypto` module. It is a **cryptographically secure** random number generator. Plain `Math.random()` is predictable and should not be used for ids you want to be unguessable.
- **Lines 3-6** the comment explains why: 36 possible characters ^ 8 positions = 2,821,109,907,456 ids (~2.8 trillion). A collision is possible but very unlikely, and the database's unique constraint is the safety net.
- **Line 7** the 36 allowed characters.
- **Line 8** `PUBLIC_ID_LENGTH = 8`, exported so tests or other code can use it.
- **Line 9** the pattern that valid ids must match (see Chapter 3.6). Not exported, used only by `isPublicId`.
- **Lines 11-17** `newPublicId()`: starts with an empty string, then 8 times picks one random character. `randomInt(36)` returns a whole number from 0 to 35, which indexes into `ALPHABET`.
- **Lines 19-21** `isPublicId(value: unknown): value is string`: a **type guard** (Chapter 3.5). It takes `unknown` (anything) and returns `true` only for a string that matches the pattern. The `typeof value === "string"` part comes first so the regex never sees a non-string.

> **Where it is used as a gate:** server actions call `isPublicId(publicId)` _before_ using a value from the client. A caller could send anything (a number, `"../../etc"`), so it must be validated server-side.

## 6.2 `lib/uploads.ts`: keys, URLs and the WebP check

_lib/uploads.ts, lines 1-7_

```ts
// Relative import: also loaded by vitest and the tsx scripts.
import { MAX_IMAGES } from "./cat-limits";

// Listing photos live in Cloudflare R2 (lib/cloudflareR2.ts) under
// "cats/<publicId>-<n>.webp", n = 1..MAX_IMAGES, and browsers load them from
// the bucket's public domain (R2_PUBLIC_URL).
const CAT_PHOTO_KEY = new RegExp(`^cats/[a-z0-9]{8}-[1-${MAX_IMAGES}]\\.webp$`);
```

**Example explained**

- **Line 1-2** a **relative** import (`./cat-limits`), not the usual `@/lib/...` alias. The comment says why: this file is also loaded by vitest and by `tsx` scripts, which may not resolve the `@/` alias.
- **Lines 4-6** document the key format: `cats/<publicId>-<n>.webp`, where `n` runs from 1 to `MAX_IMAGES`.
- **Line 7** builds the pattern with a **template string** so that the allowed digit range follows `MAX_IMAGES`. With `MAX_IMAGES = 5` the result is:

  ```text
  ^cats\/[a-z0-9]{8}-[1-5]\.webp$
  ```

  `\/` is a literal slash, `[1-5]` one digit from 1 to 5, `\.` a literal dot (inside the string they are written `\\.`, see Chapter 3.6). Anchored at both ends, so only exact, well-formed keys match.

> **Gotcha for later:** `[1-${MAX_IMAGES}]` only works while `MAX_IMAGES` is a **single digit**. If you set it to 10 you get `[1-10]`, which regex reads as "the character `1`, or the character `0`", not "1 to 10". Chapter 19 shows how to fix that when you raise the limit.

_lib/uploads.ts, lines 9-15_

```ts
export function catPhotoKey(publicId: string, n: number) {
  return `cats/${publicId}-${n}.webp`;
}

export function isCatPhotoKey(key: string) {
  return CAT_PHOTO_KEY.test(key);
}
```

**Example explained**

- **Lines 9-11** `catPhotoKey(publicId, n)` builds a key like `cats/gj34jfxk-1.webp` from the listing's public id and the photo's 1-based position. This is the _only_ place keys are built, so the format lives in one place.
- **Lines 13-15** `isCatPhotoKey(key)` returns `true` only for well-formed keys. It is used before deleting, so a damaged or hostile value in the database could never make the app delete an unrelated object.

_lib/uploads.ts, lines 17-22_

```ts
// Public URL of a photo on the bucket's public domain.
export function catPhotoUrl(key: string) {
  const base = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");
  if (!base) throw new Error("R2_PUBLIC_URL is not set");
  return `${base}/${key}`;
}
```

**Example explained**

- **Line 19** reads `R2_PUBLIC_URL` and strips trailing slashes: `.replace(/\/+$/, "")` means "one or more `/` at the end of the string, replaced with nothing". `?.` (**optional chaining**) means: if the variable is `undefined`, skip the `.replace` and give `undefined` instead of crashing.
- **Line 20** if it is empty or unset, **throw**. Failing loudly beats generating broken URLs like `undefined/cats/x.webp`.
- **Line 21** joins them: `https://img.example.com` + `/` + `cats/gj34jfxk-1.webp`.

Because only the _key_ is stored in Postgres, you can change the public domain (for example from `r2.dev` to a custom domain) by changing one environment variable. No data migration.

_lib/uploads.ts, lines 24-30_

```ts
export function isWebp(buf: Buffer) {
  return (
    buf.length > 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  );
}
```

**Example explained**

- **Line 24** `isWebp(buf: Buffer)`.
- **Line 26** `buf.length > 12`: the file must be longer than 12 bytes, otherwise reading bytes 8-11 would be meaningless.
- **Line 27** `buf.toString("ascii", 0, 4) === "RIFF"`: decode bytes 0 to 3 (end index exclusive) as ASCII text and compare.
- **Line 28** the same for bytes 8 to 11 and `"WEBP"`. Bytes 4-7 hold the file size, which we skip.
- `&&` chains all three; `return` hands back the boolean.

## Chapter 6 quiz

1. Why is `randomInt` used instead of `Math.random()`?
2. What does `isPublicId(123)` return, and why does the order `typeof value === "string" && ...` matter?
3. What key does `catPhotoKey("abcd1234", 3)` produce?
4. `catPhotoUrl("cats/abcd1234-3.webp")` with `R2_PUBLIC_URL=https://img.example.com/` returns what?
5. What happens if `R2_PUBLIC_URL` is not set?
6. What is the weakness of `isWebp`?

<details>
<summary>Show answers</summary>

1. `randomInt` is cryptographically secure, so ids cannot be predicted.
2. `false`. The `typeof` check runs first so the regex is only ever applied to a string.
3. `cats/abcd1234-3.webp`.
4. `https://img.example.com/cats/abcd1234-3.webp` (the trailing slash is stripped).
5. `catPhotoUrl` throws `R2_PUBLIC_URL is not set`.
6. It only checks the 12-byte header. A file with a correct header and garbage after it would still pass.

</details>

---

# Chapter 7: The R2 client: `lib/cloudflareR2.ts`

This is the only file that talks to R2. If you want to understand the S3 side of the system, this is it. All of it is 63 lines.

## 7.1 Creating the client

_lib/cloudflareR2.ts, lines 1-5_

```ts
import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
```

- **Lines 1-5** import three things from the AWS SDK: the client class (`S3Client`) and the two command classes the app needs (`PutObjectCommand`, `DeleteObjectsCommand`).
- Importing only the commands you use keeps the bundle small, one of the reasons the SDK is split into "client + commands".

_lib/cloudflareR2.ts, lines 7-22_

```ts
// Cloudflare R2 through its S3-compatible API. Server code only (it holds the
// secret key); no "server-only" import so the tsx scripts can use it too.
export const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
  // Only send/verify checksums when an operation requires one; Cloudflare
  // recommends this for aws-sdk-js-v3 >= 3.729 against R2.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

export const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET!;
```

**Example explained**

- **Lines 7-8** a comment with two important facts: this file holds the secret key, so it is for **server code only**; and it deliberately does **not** `import "server-only"`, so that the `tsx` script (`scripts/check-r2.ts`) can import it. Other server-only files, like `lib/cats.ts`, do use that import. The consequence is that nothing stops a client component from importing this file by mistake, so **you** must not.
- **Line 9** `export const s3 = new S3Client({ ... })`: the client is created **once**, when the module is first loaded, and reused for every request.
- **Line 10** `region: "auto"` (Chapter 2.5).
- **Line 11** `endpoint`: where the S3 API lives (Door 1).
- **Lines 12-15** `credentials`: the Access Key ID and Secret Access Key. The SDK uses them to sign each request.
- **Lines 16-19** the checksum settings (Chapter 2.8). `requestChecksumCalculation` controls uploads; `responseChecksumValidation` controls downloads. `"WHEN_REQUIRED"` means "only when the operation demands it".
- **Line 22** exports the bucket name so other files (and tests) can refer to it. Every command needs a `Bucket`.

## 7.2 Uploading a photo

_lib/cloudflareR2.ts, lines 24-38_

```ts
// Keys are never reused (each listing has its own public id and photos can't
// be edited), so browsers and Cloudflare's CDN may keep them for a year.
const PHOTO_CACHE_CONTROL = "public, max-age=31536000, immutable";

export async function putCatPhoto(key: string, body: Buffer) {
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: "image/webp",
      CacheControl: PHOTO_CACHE_CONTROL,
    }),
  );
}
```

**Example explained**

- **Lines 24-26** the cache header as a named constant, with a comment recording the reasoning: keys are never reused, so a year-long, immutable cache is safe (Chapter 3.1).
- **Line 28** `putCatPhoto(key, body)`: `key` is the object's name; `body` is a Node `Buffer` holding the WebP bytes. It is `async`, so it returns a Promise.
- **Line 29** `s3.send(new PutObjectCommand({...}))`: the client + command pattern (Chapter 2.6). Awaiting it waits until R2 has stored the object.
- **Lines 30-35** the command's inputs. These names start with a capital letter because they mirror the S3 API's own field names:
  - `Bucket`: which bucket.
  - `Key`: the object's name.
  - `Body`: the bytes.
  - `ContentType`: stored as the object's content type.
  - `CacheControl`: stored as its cache header.
- The function does **not** catch errors. If the upload fails, the Promise rejects and the caller (`submitForm`) decides what to do. Contrast this with the delete function below.

## 7.3 Deleting photos

_lib/cloudflareR2.ts, lines 40-63_

```ts
// Best-effort: a leftover object only wastes storage, so this logs instead of
// throwing and never undoes the database change that made it unreachable.
export async function deleteCatPhotos(keys: string[]) {
  if (keys.length === 0) return;
  try {
    // DeleteObjects takes at most 1000 keys per request.
    for (let i = 0; i < keys.length; i += 1000) {
      const { Errors } = await s3.send(
        new DeleteObjectsCommand({
          Bucket: R2_BUCKET,
          Delete: {
            Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })),
            Quiet: true,
          },
        }),
      );
      if (Errors?.length) {
        console.error("Couldn't remove some listing photos from R2", Errors);
      }
    }
  } catch (error) {
    console.error("Couldn't remove listing photos from R2", error);
  }
}
```

**Example explained**

- **Lines 40-41** the comment states the philosophy: deleting is **best-effort**. A leftover object only wastes storage. The function logs problems and never throws, so a failed cleanup can never undo the database change that already made the photos unreachable.
- **Line 43** an early `return` for an empty list. S3 rejects a `DeleteObjects` request that contains no keys.
- **Line 44** `try {` wraps everything so that no error escapes.
- **Lines 45-46** `DeleteObjects` accepts **at most 1000 keys per request**, so the loop steps through the list 1000 at a time: `i` is 0, 1000, 2000 … The app lists at most 5 keys per listing, but the purge job deletes many listings at once, so batching is a real need.
- **Line 47** `const { Errors } = await s3.send(...)`: **destructuring**, picking one property from the response object.
- **Lines 49-52** the command's inputs. `Delete.Objects` must be a list of `{ Key: "..." }` objects. `keys.slice(i, i + 1000)` takes the current batch, and `.map((Key) => ({ Key }))` turns each string into `{ Key: "that string" }`. The `({ Key })` is **shorthand property syntax**: `{ Key }` means `{ Key: Key }`. The parentheses are required so JavaScript reads `{` as an object, not a function body.
- **Line 52** `Quiet: true`: the response will only mention failures.
- **Lines 56-58** `Errors?.length`: `Errors` is `undefined` when nothing failed (that is what `?.` handles). When it is a non-empty list, some keys were not deleted. Note that `DeleteObjects` can answer "200 OK" **and** include per-key errors in the body, so the response must be inspected. It is not enough that `await` did not throw.
- **Lines 60-62** `catch`: logs anything that threw (network failure, bad credentials, …). If one batch throws, the remaining batches are skipped; with at most a few batches this is accepted as a trade-off.

> **Try it:** open a terminal in the project and run `npm run r2:check` (Chapter 16). It calls `putCatPhoto` and `deleteCatPhotos` against your real bucket and tells you whether the whole setup works.

## Chapter 7 quiz

1. What are the two doors, and which one does `s3` use?
2. Why is `putCatPhoto` allowed to throw, while `deleteCatPhotos` never does?
3. Why does `deleteCatPhotos` loop in steps of 1000?
4. `keys.slice(i, i + 1000).map((Key) => ({ Key }))`: what does it produce for `["a.webp", "b.webp"]`?
5. Why must you not import `lib/cloudflareR2.ts` into a client component?
6. What do `ContentType` and `CacheControl` become after upload?

<details>
<summary>Show answers</summary>

1. S3 API endpoint (private, signed) and the public domain. `s3` uses the S3 API endpoint (Door 1).
2. A failed upload must stop the listing from being created, so the caller needs the error. A failed delete only leaves a harmless leftover file, and must not undo the database change, so it just logs.
3. S3's `DeleteObjects` allows at most 1000 keys per request.
4. `[{ Key: "a.webp" }, { Key: "b.webp" }]`.
5. It reads the secret key from the environment; code in a client component would be sent to the browser (and the variables would not even be available there).
6. They are stored with the object and returned as `Content-Type` and `Cache-Control` headers when the object is fetched.

</details>

---

# Chapter 8: The database tables and migrations

Postgres holds the pointers to photos, not the photos.

## 8.1 The `cats` table (relevant columns)

_db/schema.ts, lines 109-115_

```ts
export const cats = pgTable(
  "cats",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    // Random 8-character id (a-z, 0-9) used in URLs and R2 photo keys, so the
    // sequential id never leaves the server. See lib/public-id.ts.
    publicId: text("public_id").notNull().unique(),
```

_db/schema.ts, line 150_

```ts
    check("cats_public_id_check", sql`${table.publicId} ~ '^[a-z0-9]{8}$'`),
```

- **Line 110** the table is named `cats`.
- **Line 112** `id: integer().primaryKey().generatedByDefaultAsIdentity()`: the sequential internal id. It never leaves the server.
- **Lines 113-115** `publicId`: stored in column `public_id`. `.notNull().unique()`: every cat has one, and no two cats can share one.
- **Line 150** a **CHECK constraint**: the database itself refuses any `public_id` that does not match `^[a-z0-9]{8}$`. (`~` is Postgres's regex-match operator.) So even code that forgot to validate could not store a malformed id.

> **Why unique matters here:** the unique constraint is what makes the upload safe. Two listings can never have the same `public_id`, so they can never produce the same photo keys. Chapter 12 builds on this.

## 8.2 The `cat_images` table

_db/schema.ts, lines 158-173_

```ts
export const catImages = pgTable(
  "cat_images",
  {
    id: uuid().primaryKey().defaultRandom(),
    catId: integer("cat_id")
      .notNull()
      .references(() => cats.id, { onDelete: "cascade" }),
    // R2 object key, "cats/<publicId>-<n>.webp" (lib/uploads.ts). The public
    // URL is built from it by catPhotoUrl.
    key: text().notNull(),
    caption: text(),
    // 0 = cover photo
    position: integer().notNull(),
  },
  (table) => [index("cat_images_catId_idx").on(table.catId)],
);
```

**Example explained**

- **Line 158** `catImages` is the TypeScript name; the real table is `"cat_images"` (line 159).
- **Line 161** `id`: a random UUID, generated by the database (`defaultRandom()`).
- **Lines 162-164** `catId` (column `cat_id`): which cat this photo belongs to. `.references(() => cats.id, { onDelete: "cascade" })` creates a **foreign key** with **cascade**:
  - _Foreign key_: the database guarantees every `cat_id` matches a real `cats.id`.
  - _Cascade_: when a row in `cats` is deleted, the database **automatically deletes** that cat's rows in `cat_images`. The delete and purge code relies on this: they delete only from `cats`.
- **Lines 165-167** `key`: the R2 object key. The comment tells you where its format is defined.
- **Line 168** `caption`: optional text (no `.notNull()`).
- **Lines 169-170** `position`: 0 is the cover photo, 1 the second, and so on. This is the order the user arranged.
- **Line 172** an **index** on `cat_id`. Almost every query asks "give me the photos of cat X", and the index makes that fast.

> **Position vs key number.** `position` starts at 0, but the number in the key starts at 1 (`cats/gj34jfxk-1.webp` has `position` 0). `submitForm` maps one to the other with `i + 1`.

> **Cascade only deletes database rows.** The database has no idea R2 exists, so the R2 objects must be deleted by application code. That is the whole reason `deleteCatPhotos` is called in the delete and purge flows.

## 8.3 Migrations

A **migration** is a SQL file that changes the database structure. This repo's later migrations are written **by hand** (see the "Commands" section of `AGENTS.md`), and each uses `IF NOT EXISTS`-style guards so it is safe to run twice. There are three that matter for photos. They show how the system moved from "photos stored in the database" to R2.

**Migration 1: `20261111020000_shared_photo_storage`**

_drizzle/20261111020000_shared_photo_storage/migration.sql, line 1_

```sql
ALTER TABLE "cat_images" ADD COLUMN IF NOT EXISTS "data" text;
```

Before R2, photo bytes were stored in Postgres as base64 text. This added the `data` column for that. It is history.

**Migration 2: `20261120000000_cats_public_id`**

_drizzle/20261120000000_cats_public_id/migration.sql, lines 1-28_

```sql
-- Random 8-character public id for each listing (URLs and R2 photo keys).
ALTER TABLE "cats" ADD COLUMN IF NOT EXISTS "public_id" text;
--> statement-breakpoint
-- Backfill existing listings. The reference to "cats"."id" keeps the
-- subquery correlated, so every row gets its own random id.
UPDATE "cats" SET "public_id" = (
  SELECT string_agg(
    substr('abcdefghijklmnopqrstuvwxyz0123456789', floor(random() * 36)::int + 1, 1),
    ''
  )
  FROM generate_series(1, 8 + 0 * "cats"."id")
)
WHERE "public_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "cats" ALTER COLUMN "public_id" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cats_public_id_unique') THEN
    ALTER TABLE "cats" ADD CONSTRAINT "cats_public_id_unique" UNIQUE ("public_id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cats_public_id_check') THEN
    ALTER TABLE "cats" ADD CONSTRAINT "cats_public_id_check" CHECK ("public_id" ~ '^[a-z0-9]{8}$');
  END IF;
END $$;
--> statement-breakpoint
-- Photo URLs are now derived from the key; "url" is dropped once every photo
-- has moved to R2. Until then new rows don't need to fill it in.
ALTER TABLE "cat_images" ALTER COLUMN "url" SET DEFAULT '';
```

**Example explained**

- **Line 2** adds the `public_id` column, initially nullable (so existing rows are allowed to be empty for a moment). `IF NOT EXISTS` makes the statement safe to repeat.
- **Line 3** `--> statement-breakpoint` is a marker Drizzle uses to split a file into separate statements.
- **Lines 4-13** the **backfill**: fill in a random id for every existing cat. `string_agg(..., '')` glues 8 random characters together; `generate_series(1, 8 + 0 * "cats"."id")` produces the numbers 1 to 8. The odd `+ 0 * "cats"."id"` adds nothing numerically, but it makes the subquery refer to the outer row, which forces Postgres to run it **once per row**. Without it Postgres might compute one random string and give every cat the same id. `WHERE "public_id" IS NULL` means rows that already have an id are skipped.
- **Line 15** now that every row has a value, make the column `NOT NULL`.
- **Lines 17-24** a `DO $$ BEGIN ... END $$;` block is a small program inside SQL. It checks `pg_constraint` (Postgres's list of constraints) and only adds the unique constraint and the CHECK constraint if they are not already there, which makes the migration re-runnable.
- **Lines 26-28** the `url` column used to be required. Since URLs are now built from keys, new rows will not fill it in, so give it a default of `''` until the column can be dropped.

**Migration 3: `20261120010000_drop_cat_images_legacy`**

_drizzle/20261120010000_drop_cat_images_legacy/migration.sql, lines 1-5_

```sql
-- Every photo now lives in R2 (moved by the one-off photos:migrate script), and
-- photo URLs are built from the key, so the base64 bytes and stored URL go.
ALTER TABLE "cat_images" DROP COLUMN IF EXISTS "data";
--> statement-breakpoint
ALTER TABLE "cat_images" DROP COLUMN IF EXISTS "url";
```

Once every old photo had been copied to R2 (a one-off script, now removed, which verified each copy byte for byte), the old columns were dropped. Run this **only** after all photos are in R2: it permanently deletes the old copies.

> **Applying migrations:** the repo has no Drizzle journal table for these hand-written files, so do **not** use `drizzle-kit migrate` (it would replay everything). Run the SQL files directly. This is documented in `AGENTS.md` and `docs/image_storage/README.md`.

## Chapter 8 quiz

1. What does `ON DELETE CASCADE` do for `cat_images`?
2. Why must application code still delete from R2 when a cat is deleted?
3. `cat_images.position` is 0 for the first photo. What number is in the first photo's key?
4. What are two protections against a malformed `public_id`?
5. In the backfill, why does the query mention `"cats"."id"` at all?

<details>
<summary>Show answers</summary>

1. Deleting a `cats` row automatically deletes that cat's `cat_images` rows.
2. The database only manages its own rows. It cannot reach into R2.
3. `1` (`cats/<publicId>-1.webp`).
4. The application's `isPublicId` check and the database's `cats_public_id_check` CHECK constraint (plus the unique constraint to prevent duplicates).
5. So the subquery is correlated with the outer row and runs per row, giving each cat its own random id.

</details>
***

# Chapter 9: Compressing in the browser

File: `lib/compress-image.ts` (runs **in the browser**).

A phone photo can be 5-15 MB. Uploading that, five times, would be slow and expensive to store. So before anything is sent, each photo is:

1. **Decoded** into pixels (HEIC from iPhones is handled too).
2. **Resized** so the long side is at most 1600 px (never enlarged).
3. **Re-encoded** as **WebP** at a quality chosen from the original size.
4. **Re-checked**: if still above 1 MiB, shrunk once more.

The result is a new `File` that is always WebP and (almost always) under 1 MiB. As a side effect, re-encoding through a canvas **drops the photo's metadata** (such as GPS location), which is good for privacy.

## 9.1 Imports and the error class

_lib/compress-image.ts, lines 1-8_

```ts
import {
  HEIF_IMAGE_TYPES,
  MAX_DIMENSION,
  TARGET_SIZE_BYTES,
} from "@/lib/cat-limits";

/** Thrown with a message that is safe to show to the user. */
export class ImageUploadError extends Error {}
```

- **Lines 1-5** the three limits from Chapter 5.
- **Line 7** a doc comment: this error's message is safe to show to users.
- **Line 8** `class ImageUploadError extends Error {}`: an **empty subclass** of `Error`. It adds nothing except a _name_. Code can later ask `err instanceof ImageUploadError` to tell "an error with a friendly message" apart from "an unexpected crash".

## 9.2 Picking the first-pass quality

_lib/compress-image.ts, lines 10-21_

```ts
/**
 * Picks the first-pass WebP quality from how far over the target the original
 * file is. Small files keep more detail; huge ones start lower so the first
 * pass usually lands under the limit on its own.
 */
function firstPassQuality(fileSize: number) {
  const ratio = fileSize / TARGET_SIZE_BYTES;
  if (ratio <= 2) return 0.82;
  if (ratio <= 5) return 0.72;
  if (ratio <= 10) return 0.62;
  return 0.52;
}
```

- `fileSize / TARGET_SIZE_BYTES` is "how many times bigger than the target is the original?".
- A small original (≤2× target) keeps high quality (0.82). A huge one (>10× target) starts at 0.52 so the first attempt usually fits.
- Canvas encoders take quality as a number from **0 to 1**.
- This is a heuristic (a rule of thumb) to avoid doing many trial encodes. Lower quality means smaller files but visible blockiness.

## 9.3 Decoding

_lib/compress-image.ts, lines 23-38_

```ts
async function decodeImage(file: File) {
  // Apply the photo's orientation before discarding its metadata.
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (error) {
    const extension = file.name.match(/\.[^.]+$/)?.[0].toLowerCase();
    if (
      !HEIF_IMAGE_TYPES.some((type) => type === file.type || type === extension)
    ) {
      throw error;
    }

    const { heicTo } = await import("heic-to/csp");
    return heicTo({ blob: file, type: "bitmap" });
  }
}
```

**Example explained**

- **Line 26** `createImageBitmap(file, { imageOrientation: "from-image" })` decodes the picture into an `ImageBitmap` (pixels in memory). The option applies the photo's **EXIF orientation**: phones often store pictures sideways plus a "rotate me" flag. Because the flag is lost when we re-encode, we must rotate the pixels now.
- **`return await`** (line 26): the `await` is deliberate. Without it, the Promise would be returned from the function and a rejection would escape the `try/catch` around it.
- **Line 27** if decoding fails, we enter `catch`. Browsers other than Safari cannot decode HEIC.
- **Line 28** gets the file extension: the regex `/\.[^.]+$/` means "a dot, followed by one or more non-dot characters, to the end", `.match(...)?.[0]` takes the matched text (or `undefined`), `.toLowerCase()` normalises it.
- **Lines 29-33** `HEIF_IMAGE_TYPES.some(...)` checks whether the file's MIME type **or** extension is on the HEIF list. If not, it is a genuinely bad file, so rethrow the error.
- **Line 35** `await import("heic-to/csp")`: a **dynamic import**. The HEIC converter is a large library, so it is downloaded **only** when someone actually picks a HEIC photo. Everyone else never pays for it.
- **Line 36** `heicTo({ blob: file, type: "bitmap" })` converts HEIC to an `ImageBitmap`, the same type the normal path produces.

## 9.4 Encoding to WebP

_lib/compress-image.ts, lines 40-68_

```ts
async function encodeWebp(
  source: CanvasImageSource,
  width: number,
  height: number,
  quality: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is unavailable.");
  try {
    ctx.drawImage(source, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    if (blob?.type === "image/webp") return blob;

    // Safari can decode WebP but may return PNG when asked to encode it.
    const { default: encode } = await import("@jsquash/webp/encode.js");
    const bytes = await encode(ctx.getImageData(0, 0, width, height), {
      quality: Math.round(quality * 100),
    });
    return new Blob([bytes], { type: "image/webp" });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
```

**Example explained**

- **Lines 40-45** the function takes a drawable `source`, the target size and a quality.
- **Lines 46-48** a `<canvas>` element is created in memory (never added to the page) and sized.
- **Lines 49-50** `getContext("2d")` gives the drawing API. It can theoretically be `null`, so we throw if so.
- **Line 52** `drawImage(source, 0, 0, width, height)` draws the bitmap onto the canvas **scaled** to the target size. This is the actual resize.
- **Lines 53-55** `canvas.toBlob(callback, "image/webp", quality)` turns the canvas into a file. It predates Promises and uses a callback, so it is wrapped in `new Promise(resolve => ...)`, passing `resolve` as the callback. `toBlob` can give `null`, hence `Blob | null`.
- **Line 56** if the result really is WebP, return it.
- **Lines 58-63** the **Safari fallback**. Some Safari versions can _read_ WebP but when asked to _write_ it they quietly hand back a PNG instead. We detect that (`type` is not `image/webp`) and encode with `@jsquash/webp`, a WebAssembly encoder, loaded on demand. `getImageData` reads the raw pixels; `quality` there is 0-100, so we multiply by 100 and round.
- **Lines 64-67** `finally` always runs. Setting the canvas width/height to 0 releases its big pixel buffer, which matters on phones with little memory.

## 9.5 The main function

_lib/compress-image.ts, lines 70-80_

```ts
/**
 * Resizes to MAX_DIMENSION and re-encodes as WebP under TARGET_SIZE_BYTES,
 * in at most two encodes. Errors thrown are ImageUploadError with a plain
 * message; the technical cause goes to the console.
 */

export async function compressImage(file: File): Promise<File> {
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await decodeImage(file);

```

- **Lines 70-74** the doc comment explains the contract: at most two encodes, and errors are `ImageUploadError`s with plain messages (details go to the console).
- **Line 76** `compressImage(file: File): Promise<File>`: File in, File out.
- **Line 77** `let bitmap` is declared _outside_ the `try` so that the `finally` block (line 117) can close it.
- **Line 79** decode.

_lib/compress-image.ts, lines 81-89_

```ts
    const scale = Math.min(
      1,
      MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    let width = Math.max(1, Math.round(bitmap.width * scale));
    let height = Math.max(1, Math.round(bitmap.height * scale));
    const quality = firstPassQuality(file.size);

    let blob = await encodeWebp(bitmap, width, height, quality);
```

- **Lines 81-84** the scale factor: `MAX_DIMENSION / Math.max(width, height)` is "how much do we need to shrink the longest side?". `Math.min(1, ...)` makes sure we never scale **up**.
- **Lines 85-86** the new width and height. `Math.round` keeps whole pixels; `Math.max(1, ...)` makes sure a very thin image never rounds to 0 pixels.
- **Line 87** pick the quality.
- **Line 89** the first encode.

_lib/compress-image.ts, lines 91-98_

```ts
    if (blob.size > TARGET_SIZE_BYTES) {
      // Second (last) pass: file size scales roughly with pixel count, so
      // shrink the area by the overshoot, with 10% headroom.
      const shrink = Math.sqrt((TARGET_SIZE_BYTES * 0.9) / blob.size);
      width = Math.max(1, Math.round(width * shrink));
      height = Math.max(1, Math.round(height * shrink));
      blob = await encodeWebp(bitmap, width, height, quality);
    }
```

- **Line 91** still too big? Do a second pass.
- **Lines 92-96** the key idea: file size grows roughly with **pixel count** (width × height). To cut the size by a factor `r`, you must scale _each side_ by `√r`. So `shrink = √(target × 0.9 / actualSize)`. The `0.9` leaves 10% headroom so the result lands below the limit rather than right on it.
- **Line 97** encode again at the smaller size (same quality).

_lib/compress-image.ts, lines 100-107_

```ts
    if (blob.size > TARGET_SIZE_BYTES) {
      console.error(
        `${file.name}: still ${blob.size} bytes after two passes (target ${TARGET_SIZE_BYTES}).`,
      );
      throw new ImageUploadError(
        `${file.name}: this photo is too large. Please try a different one.`,
      );
    }
```

- If it is _still_ too large after two passes, give up: log the technical detail for developers (line 101) and throw a friendly `ImageUploadError` for the user (lines 104-106).

_lib/compress-image.ts, lines 109-110_

```ts
    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp" });
```

- **Line 109** replaces the old extension with `.webp`: `"IMG_1.HEIC"` becomes `"IMG_1.webp"`. (The server ignores this name and generates its own keys. It only matters for the preview.)
- **Line 110** wraps the Blob as a `File` with type `image/webp`.

_lib/compress-image.ts, lines 111-120_

```ts
  } catch (err) {
    if (err instanceof ImageUploadError) throw err;
    console.error(`Compressing ${file.name} failed:`, err);
    throw new ImageUploadError(
      `${file.name}: couldn't open or convert this photo. Try another copy saved as JPEG or PNG.`,
    );
  } finally {
    bitmap?.close();
  }
}
```

- **Line 112** an `ImageUploadError` is already friendly, so rethrow it unchanged.
- **Lines 113-116** anything else is unexpected: log it, and throw a friendly error suggesting JPEG or PNG.
- **Lines 117-119** `finally` closes the bitmap so its memory is freed, whether we succeeded or failed.

> **Remember:** nothing in the browser can be trusted by the server. A determined user could skip this file entirely and send anything to the server action. That is why the server checks size and WebP header again (Chapter 12).

## Chapter 9 quiz

1. Why does the code pass `imageOrientation: "from-image"`?
2. Why is `heic-to` loaded with `await import(...)` instead of a normal `import`?
3. Why does Safari need a fallback encoder?
4. To halve a file's size, by what factor should the width and height each shrink, assuming size ∝ pixels?
5. What does `ImageUploadError` buy us?
6. Does this file stop a malicious user from uploading a 50 MB file?

<details>
<summary>Show answers</summary>

1. Phones store rotation as a flag. We lose the flag when we re-encode, so we apply the rotation to the pixels first.
2. So the large HEIC library is downloaded only for users who actually pick a HEIC photo.
3. Some Safari versions return a PNG when asked for WebP, so a WebAssembly WebP encoder is used instead.
4. √0.5 ≈ 0.71 (about 71% each side).
5. A way to separate "safe to show the user" errors from unexpected ones, using `instanceof`.
6. No. It runs in the browser, which the user controls. The server re-checks the size.

</details>

---

# Chapter 10: The photo picker: `ImageGallery.tsx`

File: `app/(pages)/add_a_cat/ImageGallery.tsx` (a **client component**, runs in the browser).

It lets the user add, remove, caption and reorder up to five photos. It does **not** upload anything. It only prepares a list of compressed `File`s and hands it back to its parent form.

> **Note on scope:** much of this file is user-interface code (drag and drop, keyboard reordering, styling). It is explained here in full because it is part of the image system, but the parts you will touch most are `addFiles` and the object-URL handling.

## 10.1 Imports, the data shape, and `moveItem`

_app/(pages)/add_a_cat/ImageGallery.tsx, lines 1-17_

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { GripVertical, ImagePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CatDoodle from "@/components/view/doodles/CatDoodle";
import { cn } from "@/lib/utils";
import { compressImage, ImageUploadError } from "@/lib/compress-image";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGES,
  MAX_INPUT_SIZE_BYTES,
  MAX_INPUT_SIZE_MB,
} from "@/lib/cat-limits";
```

- **Line 1** `"use client"` makes this a client component (needed for state, event handlers and browser APIs).
- **Lines 3-5** React hooks, the `Image` component, and three icons.
- **Lines 7-10** shared UI pieces and the `cn` helper that joins class names.
- **Line 11** `compressImage` and the `ImageUploadError` class from Chapter 9.
- **Lines 12-17** the limits from Chapter 5.

_app/(pages)/add_a_cat/ImageGallery.tsx, lines 19-31_

```tsx
export type GalleryImage = {
  id: string;
  file: File;
  previewUrl: string;
  caption: string;
};

function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
```

- **Lines 19-24** `GalleryImage` describes one photo in the list. `id` is a random id used as the React key and to identify drags; `file` is the **already compressed** WebP; `previewUrl` is an object URL (Chapter 3.8); `caption` is the user's text.
- **Lines 26-31** `moveItem<T>` returns a **new** list with one item moved. `<T>` makes it **generic**, working for any element type. It copies the list first (`[...list]`) because React state must never be modified in place. `splice(from, 1)` removes one element and returns it as `[item]`; `splice(to, 0, item)` inserts it at the new place.

## 10.2 The component's props and state

_app/(pages)/add_a_cat/ImageGallery.tsx, lines 33-48_

```tsx
export default function ImageGallery({
  images,
  onChange,
}: {
  images: GalleryImage[];
  onChange: (images: GalleryImage[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Reorder (drag) state
  const [armedId, setArmedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
```

- **Lines 33-39** the component takes `images` and `onChange` as **props**. This is a **controlled component**: the parent form owns the list, and this component asks the parent to change it. That is how the form can later read the photos when it submits.
- **Line 40** `fileInputRef` points to the hidden `<input type="file">` so a button can open it.
- **Lines 41-43** `errors` (messages for rejected files), `isDropTarget` (is a file being dragged over the box?), `isProcessing` (is compression running?).
- **Lines 45-48** drag-and-drop **reorder** state: `armedId` (which row's handle is pressed), `draggingId` (which row is being dragged), `overId` (which row it is hovering over).

## 10.3 Releasing preview memory

_app/(pages)/add_a_cat/ImageGallery.tsx, lines 50-60_

```tsx
  // Preview URLs are object URLs, which must be revoked to free memory.
  // Keep the latest list in a ref so we can clean up when the form unmounts.
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  useEffect(() => {
    return () => {
      imagesRef.current.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
  }, []);
```

Every preview uses an object URL that holds memory until it is revoked. When the form disappears, all of them must be revoked.

- **Line 52** `imagesRef` always holds the **latest** list.
- **Lines 53-55** after each change of `images`, update the ref.
- **Lines 56-60** `useEffect(..., [])` with an empty dependency list runs once on mount; the function it **returns** is the cleanup that runs on **unmount**. The cleanup reads `imagesRef.current` rather than `images` because a cleanup function remembers the values from the render it was created in (an empty list). The ref is the trick that gives it the current list.

## 10.4 Adding files

_app/(pages)/add_a_cat/ImageGallery.tsx, lines 62-115_

```tsx
  async function addFiles(fileList: FileList | File[]) {
    if (isProcessing) return;
    const incoming = Array.from(fileList);
    const nextErrors: string[] = [];
    const accepted: GalleryImage[] = [];
    let slotsLeft = MAX_IMAGES - images.length;

    setIsProcessing(true);
    try {
      for (const file of incoming) {
        const extension = file.name.match(/\.[^.]+$/)?.[0].toLowerCase() ?? "";
        if (
          !ACCEPTED_IMAGE_TYPES.includes(file.type) &&
          !ACCEPTED_IMAGE_TYPES.includes(extension)
        ) {
          nextErrors.push(`${file.name}: this file isn't a photo we can use.`);
        } else if (file.size > MAX_INPUT_SIZE_BYTES) {
          nextErrors.push(
            `${file.name}: this photo is too large (over ${MAX_INPUT_SIZE_MB} MB).`,
          );
        } else if (slotsLeft <= 0) {
          nextErrors.push(
            `${file.name}: you can add up to ${MAX_IMAGES} photos.`,
          );
        } else {
          try {
            // One at a time so a big batch doesn't freeze the page.
            const compressed = await compressImage(file);
            accepted.push({
              id: crypto.randomUUID(),
              file: compressed,
              previewUrl: URL.createObjectURL(compressed),
              caption: "",
            });
            slotsLeft -= 1;
          } catch (err) {
            // compressImage only throws ImageUploadError, whose message is
            // user-friendly; anything else is unexpected.
            if (err instanceof ImageUploadError) {
              nextErrors.push(err.message);
            } else {
              console.error(err);
              nextErrors.push(`${file.name}: upload failed.`);
            }
          }
        }
      }
    } finally {
      setIsProcessing(false);
    }

    setErrors(nextErrors);
    if (accepted.length > 0) onChange([...images, ...accepted]);
  }
```

**Example explained**

- **Line 63** if compression is already running, ignore the request.
- **Line 64** `Array.from(fileList)` turns a `FileList` (array-like) into a real array.
- **Lines 65-67** `nextErrors` collects messages; `accepted` collects good photos; `slotsLeft` is how many more photos fit.
- **Lines 69-70, 109-111** `setIsProcessing(true)` before the work and `setIsProcessing(false)` in `finally`, so the flag is reset even if something throws.
- **Lines 71-107** one file at a time. For each file, the checks run **in this order**:
  1. **Type** (lines 72-77): the MIME type or the extension must be in `ACCEPTED_IMAGE_TYPES`.
  2. **Size** (lines 78-81): not over 25 MB.
  3. **Count** (lines 82-85): there must be a free slot.
  4. **Compress** (lines 86-106): only now is the expensive work done.
- **Line 88-89** `await compressImage(file)` inside a plain `for ... of` loop means files are processed **one at a time**. The comment explains why: processing a big batch in parallel can freeze the page.
- **Lines 90-95** on success, build a `GalleryImage`: `crypto.randomUUID()` for the id, `URL.createObjectURL(compressed)` for the preview, empty caption. Then use up a slot.
- **Lines 97-105** on failure: if it is an `ImageUploadError` its message is friendly and is shown to the user; any other error is logged and replaced by a generic message.
- **Line 113** `setErrors(nextErrors)` shows the messages (or clears old ones).
- **Line 114** calls `onChange` **once**, with the old list plus all accepted photos. The new photos go at the end, so the first photo ever added stays the cover unless the user reorders.

## 10.5 Small helpers

_app/(pages)/add_a_cat/ImageGallery.tsx, lines 117-126_

```tsx
  function removeImage(id: string) {
    const target = images.find((img) => img.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    setErrors([]);
    onChange(images.filter((img) => img.id !== id));
  }

  function setCaption(id: string, caption: string) {
    onChange(images.map((img) => (img.id === id ? { ...img, caption } : img)));
  }
```

- `removeImage` revokes the preview URL (frees memory), clears old errors, and passes the list without that photo to the parent (`filter`).
- `setCaption` returns a copy of the list where only the matching photo has a new caption. `{ ...img, caption }` copies the object and overrides one property, the standard way to update immutable data.

_app/(pages)/add_a_cat/ImageGallery.tsx, lines 128-144_

```tsx
  function resetDrag() {
    setArmedId(null);
    setDraggingId(null);
    setOverId(null);
  }

  function dropOn(targetId: string) {
    if (draggingId && draggingId !== targetId) {
      const from = images.findIndex((img) => img.id === draggingId);
      const to = images.findIndex((img) => img.id === targetId);
      if (from !== -1 && to !== -1) onChange(moveItem(images, from, to));
    }
    resetDrag();
  }

  const isFull = images.length >= MAX_IMAGES;
  const hasImages = images.length > 0;
```

- `resetDrag` puts the three drag-state variables back to `null`.
- `dropOn(targetId)` finds the dragged row's index and the target row's index (`findIndex`, which gives `-1` if not found), and asks the parent to apply `moveItem`.
- `isFull` and `hasImages` are two booleans used to change what the screen shows.

## 10.6 The drop zone

_app/(pages)/add_a_cat/ImageGallery.tsx, lines 146-226_

```tsx
  return (
    <section className="flex flex-col gap-3" aria-labelledby="cat-photos-title">
      {/* Dropzone: a large dashed card until the first photo lands, then a
          compact one so the uploaded photos take over the column. */}
      <div
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setIsDropTarget(true);
        }}
        onDragLeave={() => setIsDropTarget(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setIsDropTarget(false);
          if (isProcessing) return;
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "relative flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-secondary/40 bg-secondary/5 text-center transition-colors",
          hasImages ? "px-4 py-5" : "px-5 py-10",
          isDropTarget && "border-secondary bg-secondary/15",
        )}
      >
        <span
          aria-hidden="true"
          className="absolute top-3 right-4 text-sm text-muted-foreground"
        >
          {images.length} / {MAX_IMAGES}
        </span>
        {!hasImages && (
          <CatDoodle name="peek" className="size-24 text-secondary" />
        )}
        <div className="grid gap-1">
          <h2
            id="cat-photos-title"
            className={cn(
              "font-extrabold",
              hasImages ? "text-base" : "text-xl",
            )}
          >
            Cat photos
          </h2>
          <p className="text-sm text-muted-foreground">
            Add up to {MAX_IMAGES} photos, {MAX_INPUT_SIZE_MB} MB each. The
            first photo is the cover.
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          aria-label="Add cat photos"
          multiple
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            // Reset so choosing the same file again still fires onChange.
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-11 bg-card font-bold"
          disabled={isFull || isProcessing}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus />
          Add photos
        </Button>
        <p role="status" className="-mt-1 text-sm text-muted-foreground">
          {isProcessing
            ? "Processing…"
            : isFull
              ? "Image limit reached"
              : "or drag and drop"}
        </p>
      </div>
```

**Example explained**

- **Lines 150-163** drag-and-drop **from the user's computer**. `onDragOver` and `onDrop` first check `e.dataTransfer.types.includes("Files")`, so dragging something else (for example a reorder drag of one of the rows) is ignored here. `e.preventDefault()` is required: a browser only allows a drop on an element if `dragover` was cancelled. On drop, `addFiles(e.dataTransfer.files)` runs the same pipeline as the file picker.
- **Lines 164-168** `cn(...)` builds the class list: bigger padding when there are no photos yet, highlighted border while a file hovers.
- **Lines 170-175** the `n / 5` counter.
- **Lines 194-207** the real `<input type="file">`. `multiple` allows several files; `accept` lists the allowed types so the file dialog filters them; `className="sr-only"` hides it visually while keeping it available to screen readers; `tabIndex={-1}` keeps it out of the keyboard tab order (the visible button replaces it). In `onChange` the files go to `addFiles`, then `e.target.value = ""` **resets the input** so picking the _same_ file again still triggers a change event.
- **Lines 208-218** the visible "Add photos" button simply clicks the hidden input: `fileInputRef.current?.click()`. It is disabled when full or busy.
- **Lines 219-225** a status line (`role="status"` is announced by screen readers): "Processing...", "Image limit reached" or "or drag and drop".

## 10.7 Errors and the list of photos

_app/(pages)/add_a_cat/ImageGallery.tsx, lines 228-237_

```tsx
      {errors.length > 0 && (
        <ul
          role="alert"
          className="flex flex-col gap-1 text-sm text-destructive"
        >
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
```

- Shows each message in a list with `role="alert"` so screen readers announce it. The message text doubles as the React `key`.

_app/(pages)/add_a_cat/ImageGallery.tsx, lines 239-269_

```tsx
      {/* Uploaded images */}
      {images.length > 0 && (
        <ul className="flex flex-col gap-3">
          {images.map((img, index) => (
            <li
              key={img.id}
              draggable={armedId === img.id}
              onDragStart={(e) => {
                setDraggingId(img.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", img.id);
              }}
              onDragOver={(e) => {
                if (!draggingId) return;
                e.preventDefault();
                if (overId !== img.id) setOverId(img.id);
              }}
              onDrop={(e) => {
                if (!draggingId) return;
                e.preventDefault();
                dropOn(img.id);
              }}
              onDragEnd={resetDrag}
              className={cn(
                "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border bg-card p-3 transition-opacity",
                draggingId === img.id && "opacity-40",
                overId === img.id &&
                  draggingId !== img.id &&
                  "border-secondary ring-2 ring-secondary/50",
              )}
            >
```

- **Line 245** `draggable={armedId === img.id}`: a row is only draggable while **its handle is pressed**. This stops dragging from interfering with selecting text in the caption box.
- **Lines 246-250** `onDragStart` records which row is dragged. `effectAllowed = "move"` shows a move cursor. `setData("text/plain", id)` is required by Firefox, which will not start a drag without some data.
- **Lines 251-255** `onDragOver` marks the row under the pointer; `preventDefault` allows dropping here.
- **Lines 256-260** `onDrop` calls `dropOn`.
- **Line 261** `onDragEnd` resets state if the drag is cancelled.
- **Lines 262-268** styling: dim the row being dragged and highlight the row it hovers.

_app/(pages)/add_a_cat/ImageGallery.tsx, lines 270-290_

```tsx
              <button
                type="button"
                aria-label={`Reorder image ${index + 1}. Drag, or use the up and down arrow keys.`}
                className="cursor-grab touch-none rounded-md p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
                onPointerDown={() => setArmedId(img.id)}
                onPointerUp={() => setArmedId(null)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp" && index > 0) {
                    e.preventDefault();
                    onChange(moveItem(images, index, index - 1));
                  } else if (
                    e.key === "ArrowDown" &&
                    index < images.length - 1
                  ) {
                    e.preventDefault();
                    onChange(moveItem(images, index, index + 1));
                  }
                }}
              >
                <GripVertical className="size-5" />
              </button>
```

- The **handle** is a `<button>`, so it can be focused with the keyboard. **Pointer down** "arms" the row; **pointer up** disarms it. **Arrow Up/Down** moves the row without a mouse (an accessibility feature): `e.preventDefault()` stops the page from scrolling, then `moveItem` shifts the row. The `index > 0` and `index < images.length - 1` guards prevent moving past the ends.

_app/(pages)/add_a_cat/ImageGallery.tsx, lines 292-306_

```tsx
              <div className="relative h-28 min-w-0 overflow-hidden rounded-lg bg-background">
                <Image
                  src={img.previewUrl}
                  alt={img.caption || img.file.name}
                  fill
                  unoptimized
                  draggable={false}
                  className="object-cover"
                />
                {index === 0 && (
                  <span className="absolute top-1 left-1 rounded-md bg-secondary px-1.5 py-0.5 text-[0.65rem] font-semibold text-secondary-foreground">
                    Cover
                  </span>
                )}
              </div>
```

- The **preview**. `src={img.previewUrl}` is the object URL. `fill` makes the image fill its relatively positioned parent. **`unoptimized`** matters here: a `blob:` URL cannot be fetched by the Next.js image optimizer (it lives only in the browser), so it must be shown as-is. `draggable={false}` stops the browser's own image drag from interfering. The row at index 0 gets a **Cover** badge: the first photo is the cover.

_app/(pages)/add_a_cat/ImageGallery.tsx, lines 308-332_

```tsx
              <Input
                aria-label={`Caption for image ${index + 1}`}
                placeholder="Add a caption (optional)"
                value={img.caption}
                onChange={(e) => setCaption(img.id, e.target.value)}
                className="col-span-3 row-start-2 h-11 min-w-0 bg-background"
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="col-start-3 row-start-1"
                aria-label={`Remove image ${index + 1}`}
                onClick={() => removeImage(img.id)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- The caption input is **controlled**: its `value` comes from the list and `onChange` calls `setCaption`. The remove button (`X` icon) calls `removeImage`. The rest closes the tags.

## Chapter 10 quiz

1. Why is `ImageGallery` a "controlled component"?
2. Why does the unmount cleanup read `imagesRef.current` instead of `images`?
3. In what order does `addFiles` run its checks, and why is compression last?
4. What problem does `e.target.value = ""` solve?
5. Why must the preview `<Image>` be `unoptimized`?
6. Who decides which photo is the cover?

<details>
<summary>Show answers</summary>

1. The parent form owns the `images` list; the gallery only displays it and calls `onChange` to request changes.
2. The cleanup function would otherwise remember the (empty) list from the first render. The ref always holds the latest list.
3. Type, size, slot count, then compress. Compression is the slow, memory-hungry step, so we only do it for files that passed the cheap checks.
4. Selecting the same file twice in a row would not fire a change event. Clearing the value makes it fire again.
5. A `blob:` preview URL exists only in the browser, so the Next.js server cannot fetch and optimize it.
6. The photo at index 0, which the user controls by reordering. It is also saved as `position` 0 and given key number 1.

</details>

---

# Chapter 11: Sending the form: `ListACat.tsx`

File: `app/(pages)/add_a_cat/ListACat.tsx` (a client component). Only the image-related lines are shown here; the rest of the form (name, breed, location, and so on) is not about image storage.

_app/(pages)/add_a_cat/ListACat.tsx, lines 11-12_

```tsx
import ImageGallery, { type GalleryImage } from "./ImageGallery";
import { submitForm } from "./actions";
```

- **Line 11** imports the gallery and its `GalleryImage` type (`type` import: erased at build).
- **Line 12** imports `submitForm`. This looks like a normal function import, but it is a **server action**: calling it from the browser sends a network request to the server and runs the function there.

_app/(pages)/add_a_cat/ListACat.tsx, line 84_

```tsx
  const [images, setImages] = useState<GalleryImage[]>([]);
```

- The form's own copy of the photo list, starting empty. It is passed down into `ImageGallery` (line 176 below).

_app/(pages)/add_a_cat/ListACat.tsx, lines 125-165_

```tsx
    if (images.length === 0) {
      setError("Please add at least one photo.");
      return;
    }

    startTransition(async () => {
      try {
        // On success the action redirects, so we only get a result back
        // when something went wrong.
        const formData = new FormData();
        formData.set("name", name);
        formData.set("breed", breed);
        formData.set("ageYears", ageYears || "0");
        formData.set("ageMonths", ageMonths || "0");
        formData.set("district", district);
        formData.set("area", area);
        formData.set("gender", gender);
        formData.set("vaccinated", vaccinated);
        formData.set("neutered", neutered);
        formData.set("temperament", temperament);
        formData.set("description", description);
        formData.set("rehomingReason", rehomingReason);
        if (needsPhone) formData.set("phone", phone);
        for (const method of contactMethods) {
          formData.append("contactMethods", method);
        }
        // Same order as the gallery: the first image is the cover.
        for (const img of images) {
          formData.append("images", img.file);
          formData.append("captions", img.caption);
        }

        const result = await submitForm(formData);
        if (result && !result.ok) setError(result.error);
      } catch (err) {
        // Network/server errors carry technical messages; keep them out of the UI.
        console.error(err);
        setError("Something went wrong. Please try again.");
      }
    });
  }
```

**Example explained**

- **Lines 125-128** the client-side check: at least one photo. It is a convenience; the server checks again.
- **Line 130** `startTransition(async () => { ... })` (from `useTransition`) runs the submit as a **transition** so React can show a pending state while it runs.
- **Line 134** a new, empty `FormData` (Chapter 3.4).
- **Lines 135-150** simple text fields are added with `set`. Multiple contact methods use `append`.
- **Lines 151-155** the photos. For each image, `append("images", img.file)` and `append("captions", img.caption)`. Because they are appended **in lockstep, in list order**, the _n_-th `images` entry matches the _n_-th `captions` entry, and the cover comes first. The server relies on exactly this pairing.
- **Line 157** `await submitForm(formData)`: **the upload happens here.** The browser sends one multipart request containing all fields and the WebP files.
- **Line 158** on success the server action **redirects**, so the call does not return a value normally. We only reach this line with a result when something went wrong: `if (result && !result.ok) setError(result.error)`.
- **Lines 159-163** if the request itself fails (network, crash), log the technical error and show a generic message. The comment explains: technical messages stay out of the UI.

_app/(pages)/add_a_cat/ListACat.tsx, line 176_

```tsx
        <ImageGallery images={images} onChange={setImages} />
```

- Renders the gallery, giving it the list and the setter. `onChange={setImages}`: whenever the gallery wants to change the list, React state is updated and the form re-renders.

## Chapter 11 quiz

1. What does calling `submitForm(formData)` from the browser actually do?
2. Why are captions appended in the same loop as images?
3. Why do we only handle a `result` when something went wrong?

<details>
<summary>Show answers</summary>

1. It sends an HTTP (multipart) request to the Next.js server, which runs the `submitForm` function there and sends back its result.
2. So `captions[i]` always matches `images[i]` and the order matches the gallery (first = cover).
3. On success `submitForm` calls `redirect("/")`, which navigates away instead of returning a value.

</details>

---

# Chapter 12: The server action: `submitForm`

File: `app/(pages)/add_a_cat/actions.ts` (runs **on the server**).

This is the heart of the upload path. It re-validates everything, creates the listing, uploads the photos to R2, and cleans up if anything goes wrong.

## 12.1 The order of operations

```text
 1  who is calling?            getSession()                    → "Please log in first."
 2  validate text fields       name, breed, location, …
 3  validate photos            count, captions, size, WebP     (nothing uploaded yet)
 4  make sure phone exists     (not about images)
 5  INSERT cats row            unique public_id "claims" the keys
 6  PutObject × N (parallel)   cats/<publicId>-1.webp … -N.webp
 7  INSERT cat_images rows     key, caption, position
 8  after(purge); redirect     done
          any failure in 5-7 → delete cats row (cascades) + DeleteObjects
```

Two design rules shape this order:

1. **Validate everything before doing anything with side effects.** Steps 2-3 can reject a request without having created or uploaded anything.
2. **Claim the name before you use it.** Step 5 happens _before_ step 6, so we know the key prefix is ours before we write to R2 (explained in 12.5).

## 12.2 Imports and types

_app/(pages)/add_a_cat/actions.ts, lines 1-29_

```ts
"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { db } from "@/db";
import { catImages, cats } from "@/db/schema";
import { getSession } from "@/lib/auth";
import {
  CONTACT_METHODS,
  MAX_DESCRIPTION_LENGTH,
  MAX_IMAGES,
  MAX_REHOMING_REASON_LENGTH,
  MAX_STORED_SIZE_BYTES,
  MAX_TEMPERAMENT_LENGTH,
  YES_NO_UNKNOWN,
} from "@/lib/cat-limits";
import { getUserPhone, saveUserPhone } from "@/lib/contact";
import { purgeExpiredListings } from "@/lib/listing-expiry";
import { isValidLocation } from "@/lib/locations";
import { normalizeBdPhone, PHONE_ERROR } from "@/lib/phone";
import { deleteCatPhotos, putCatPhoto } from "@/lib/cloudflareR2";
import { newPublicId } from "@/lib/public-id";
import { catPhotoKey, isWebp } from "@/lib/uploads";

const GENDERS = ["male", "female", "unknown"] as const;

export type ActionResult = { ok: true } | { ok: false; error: string };
```

- **Line 1** `"use server"` marks **every exported function** in this file as a server action. A server action is reachable by anyone who can send an HTTP request, not just by your form, so the function must **never trust its input**.
- **Line 3** `eq` is Drizzle's "equals" helper for `where` clauses.
- **Lines 4-5** `redirect` and `after` (Chapter 3.9).
- **Lines 7-8** the database client and the two tables.
- **Line 9** `getSession` returns the logged-in user.
- **Lines 10-18** limits and allowed values from Chapter 5.
- **Lines 19-22** helpers for phone numbers and locations (not about images).
- **Line 23** `deleteCatPhotos` and `putCatPhoto` from the R2 client (Chapter 7).
- **Line 24** `newPublicId`; **line 25** `catPhotoKey` and `isWebp` (Chapter 6).
- **Line 27** the allowed genders.
- **Line 29** the result type: `{ ok: true } | { ok: false; error: string }`. A **discriminated union**: after checking `result.ok`, TypeScript knows whether `error` exists. Expected failures are _returned_, not thrown.

## 12.3 Authentication and reading the text fields

_app/(pages)/add_a_cat/actions.ts, lines 31-36_

```ts
export async function submitForm(
  formData: FormData,
): Promise<ActionResult | never> {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "Please log in first." };
  const userId = session.user.id;
```

- **Line 31-33** the function takes the `FormData` the browser built. Its return type `ActionResult | never`: it either returns a result or never returns at all (because of `redirect`).
- **Line 34-35** no session, no upload. Every action re-derives the user on the server (see `AGENTS.md`).
- **Line 36** the user's id for the database insert later.

_app/(pages)/add_a_cat/actions.ts, lines 38-56_

```ts
  const name = String(formData.get("name") ?? "").trim();
  const breed = String(formData.get("breed") ?? "").trim();
  const district = String(formData.get("district") ?? "").trim();
  const area = String(formData.get("area") ?? "").trim();
  const gender = String(formData.get("gender") ?? "");
  const vaccinated = String(formData.get("vaccinated") ?? "");
  const neutered = String(formData.get("neutered") ?? "");
  // Optional text fields: empty becomes null.
  const optional = (key: string, max: number) =>
    String(formData.get(key) ?? "")
      .trim()
      .slice(0, max) || null;
  const temperament = optional("temperament", MAX_TEMPERAMENT_LENGTH);
  const description = optional("description", MAX_DESCRIPTION_LENGTH);
  const rehomingReason = optional("rehomingReason", MAX_REHOMING_REASON_LENGTH);
  const contactMethods = formData.getAll("contactMethods").map(String);
  const years = Number(formData.get("ageYears"));
  const months = Number(formData.get("ageMonths"));

```

- **Lines 38-44** `String(formData.get("name") ?? "").trim()`: `formData.get` returns `string | File | null`; `?? ""` replaces null; `String(...)` forces text; `.trim()` removes surrounding spaces.
- **Lines 46-49** `optional` is a small helper: trim, cut to a max length, and turn an empty result into `null` (`|| null`), which is stored as an empty database value.
- **Lines 50-52** the three optional text fields.
- **Line 53** `getAll("contactMethods")` returns every entry with that name.
- **Lines 54-55** the numbers arrive as text, so convert them.

## 12.4 Validating the text fields

_app/(pages)/add_a_cat/actions.ts, lines 57-98_

```ts
  if (!name) return { ok: false, error: "Name is required." };
  if (!breed) return { ok: false, error: "Breed is required." };
  if (!district) return { ok: false, error: "Please choose a district." };
  if (!area) return { ok: false, error: "Please choose an area." };
  if (!isValidLocation(district, area)) {
    return {
      ok: false,
      error: "Please pick a district and area from the lists.",
    };
  }
  if (!(GENDERS as readonly string[]).includes(gender)) {
    return { ok: false, error: "Please choose a gender." };
  }
  if (!(YES_NO_UNKNOWN as readonly string[]).includes(vaccinated)) {
    return { ok: false, error: "Please say whether the cat is vaccinated." };
  }
  if (!(YES_NO_UNKNOWN as readonly string[]).includes(neutered)) {
    return {
      ok: false,
      error: "Please say whether the cat is spayed/neutered.",
    };
  }
  if (!Number.isInteger(years) || years < 0 || years > 30) {
    return { ok: false, error: "Years must be between 0 and 30." };
  }
  if (!Number.isInteger(months) || months < 0 || months > 11) {
    return { ok: false, error: "Months must be between 0 and 11." };
  }
  if (years === 0 && months === 0) {
    return { ok: false, error: "Please enter the cat's age." };
  }
  if (
    contactMethods.length === 0 ||
    contactMethods.some(
      (m) => !(CONTACT_METHODS as readonly string[]).includes(m),
    )
  ) {
    return {
      ok: false,
      error: "Please choose how adopters can contact you.",
    };
  }
```

Nothing here is about images, but notice the pattern: check, and on failure `return { ok: false, error }` immediately (an **early return** or guard clause). `(GENDERS as readonly string[]).includes(gender)` widens the tuple type so `.includes` accepts a plain string (the same trick as Chapter 5). `Number.isInteger` rejects `1.5` and `NaN`. These checks mirror the browser's, because the browser's checks can be bypassed.

## 12.5 Validating the photos

_app/(pages)/add_a_cat/actions.ts, lines 100-115_

```ts
  const files = formData
    .getAll("images")
    .filter((v): v is File => v instanceof File);
  const captions = formData.getAll("captions").map(String);
  if (files.length === 0) {
    return { ok: false, error: "Please add at least one photo." };
  }
  if (files.length > MAX_IMAGES) {
    return { ok: false, error: `You can add up to ${MAX_IMAGES} photos.` };
  }
  if (captions.length !== files.length) {
    console.error(
      `submitForm: ${files.length} images but ${captions.length} captions.`,
    );
    return { ok: false, error: "Something went wrong. Please try again." };
  }
```

- **Lines 100-102** `formData.getAll("images")` returns strings and files. `.filter((v): v is File => v instanceof File)` keeps only `File`s (Chapter 3.5). If someone sent the text `"hello"` under `images`, it is dropped.
- **Line 103** the captions, forced to strings.
- **Lines 104-109** at least one photo, at most `MAX_IMAGES`.
- **Lines 110-115** the pairing check: as many captions as photos. If not, something is wrong with the request (our form never produces this), so log it and give a vague message.

_app/(pages)/add_a_cat/actions.ts, lines 117-132_

```ts
  // Read and validate everything BEFORE uploading anything.
  const buffers: Buffer[] = [];
  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > MAX_STORED_SIZE_BYTES) {
      console.error(
        `submitForm: image is ${buf.length} bytes, over the limit.`,
      );
      return { ok: false, error: "One of the photos is too large." };
    }
    if (!isWebp(buf)) {
      console.error("submitForm: uploaded image is not WebP.");
      return { ok: false, error: "Upload failed. Please try again." };
    }
    buffers.push(buf);
  }
```

**Example explained**

- **Line 117** the comment states the rule: _read and validate everything BEFORE uploading anything_.
- **Line 118** `buffers` will hold the validated bytes.
- **Line 120** `Buffer.from(await file.arrayBuffer())` converts each `File` into a Node `Buffer` (Chapter 3.3).
- **Lines 121-126** the **size check**: anything above `MAX_STORED_SIZE_BYTES` (1.25 MiB) is refused. This is the server enforcing a limit that the browser merely aims for.
- **Lines 127-130** the **format check**: `isWebp(buf)` looks at the magic bytes (Chapter 3.7). A user who sends a PNG, or any other file, is refused.
- Note the pattern for errors: the **technical detail goes to `console.error`** (for you), and the **user gets a short, vague message**. This avoids leaking internals.
- **Line 131** keep the validated buffer.

> **Limit of this check:** the server confirms the file is small and starts like a WebP. It does not decode the image or re-encode it. A file with a correct header and garbage after it would be stored (and a browser would simply fail to display it). The 1.25 MiB cap bounds the damage.

## 12.6 The phone step (not about images)

_app/(pages)/add_a_cat/actions.ts, lines 134-141_

```ts
  // Adopters reach the lister on the number from their profile. Google
  // sign-ups (and older accounts) have none yet, so take it from this form.
  if (!(await getUserPhone(userId))) {
    const phone = normalizeBdPhone(String(formData.get("phone") ?? ""));
    if (!phone) return { ok: false, error: PHONE_ERROR };
    const saved = await saveUserPhone(userId, phone);
    if (!saved.ok) return saved;
  }
```

Google sign-ups may have no phone number yet, so it is collected here and saved **before** the insert, so that a bad phone number fails the request before any listing or photo exists.

## 12.7 Claiming the listing and its keys

_app/(pages)/add_a_cat/actions.ts, lines 143-148_

```ts
  // Insert the listing first: the unique public_id claims the photo keys
  // (cats/<publicId>-<n>.webp) before anything is uploaded, so a colliding id
  // can never overwrite another listing's photos. Then upload, then save the
  // photo rows. If anything fails, the row and uploaded photos are removed.
  let catId: number | null = null;
  let keys: string[] = [];
```

- **Lines 143-146** the comment is the design in four sentences. Read it twice.
- **Lines 147-148** `catId` and `keys` are declared **outside** the `try` so the `catch` block can use them for cleanup. `catId` is `null` until a row has been inserted.

_app/(pages)/add_a_cat/actions.ts, lines 149-179_

```ts
  try {
    for (let attempt = 0; attempt < 3 && catId === null; attempt++) {
      const publicId = newPublicId();
      const [cat] = await db
        .insert(cats)
        .values({
          publicId,
          name,
          breed,
          ageMonths: years * 12 + months,
          area,
          district,
          gender,
          vaccinated,
          neutered,
          temperament,
          description,
          rehomingReason,
          contactWhatsapp: contactMethods.includes("whatsapp"),
          contactCall: contactMethods.includes("call"),
          // status defaults to 'available' in the database
          userId,
        })
        .onConflictDoNothing({ target: cats.publicId })
        .returning({ id: cats.id });
      if (cat) {
        catId = cat.id;
        keys = buffers.map((_, i) => catPhotoKey(publicId, i + 1));
      }
    }
    if (catId === null) throw new Error("Couldn't find a free public id.");
```

**Example explained**

- **Line 149** `try {` everything that can fail from here is guarded.
- **Line 150** a loop that tries **up to 3 times** and stops as soon as `catId` is set.
- **Line 151** a fresh random id each attempt.
- **Lines 152-171** `db.insert(cats).values({...})`: the row's fields. `ageMonths: years * 12 + months` stores age as a single number. `contactWhatsapp: contactMethods.includes("whatsapp")` turns the list of chosen methods into two booleans. The `status` column is not given, so it takes its default.
- **Line 172** `.onConflictDoNothing({ target: cats.publicId })`: if another row already has this `public_id`, **do nothing** instead of throwing a unique-violation error.
- **Line 173** `.returning({ id: cats.id })`: give back the new row's `id`. Postgres supports returning data from an insert, which saves a second query.
- **Line 174-177** if the insert worked, `cat` is `{ id: ... }`; remember the id and **build all the keys**: `buffers.map((_, i) => catPhotoKey(publicId, i + 1))`. The `_` means "I do not use this argument". `i + 1` because keys are numbered from 1.
- If there was a conflict, the returning list is empty, `cat` is `undefined`, `catId` stays `null`, and the loop tries a new id.
- **Line 179** after 3 failures, throw, which jumps to the `catch`.

> **Why insert first?** Remember Chapter 2.6: `PutObject` silently overwrites. Imagine the order were reversed: pick id `gj34jfxk`, upload `cats/gj34jfxk-1.webp`, _then_ insert. If another listing already had that id (a one-in-trillions collision), you would have **overwritten its photos** before the database told you about the conflict. By inserting first, the unique constraint makes the database say "that id is taken" **before any bytes are written**. Once the insert succeeds, you own the prefix `cats/<publicId>-`.

## 12.8 Uploading and saving the photo rows

_app/(pages)/add_a_cat/actions.ts, lines 181-191_

```ts
    await Promise.all(buffers.map((buf, i) => putCatPhoto(keys[i], buf)));

    const listingId = catId;
    await db.insert(catImages).values(
      keys.map((key, position) => ({
        catId: listingId,
        key,
        caption: captions[position].trim().slice(0, 200) || null,
        position,
      })),
    );
```

- **Line 181** `buffers.map((buf, i) => putCatPhoto(keys[i], buf))` starts all uploads at once (each call returns a Promise); `Promise.all` waits for all of them. Uploading in **parallel** is faster than one after another. If any upload rejects, `Promise.all` rejects and we jump to `catch`.
- **Line 183** `const listingId = catId;` looks pointless but is needed for TypeScript: inside the arrow function below, the compiler no longer remembers that `catId` is not `null` (it is a `let` variable that could change), so we copy it into a `const`, whose narrowed type is kept.
- **Lines 184-191** one multi-row insert into `cat_images`. For each key: its `catId`, the `key`, the caption (`captions[position].trim().slice(0, 200) || null`: trimmed, at most 200 characters, empty becomes `null`) and the `position`. `.map((key, position) => ...)` gives each key its index, which is 0 for the cover. The caption pairing from Chapter 11 is used here.

## 12.9 When something fails

_app/(pages)/add_a_cat/actions.ts, lines 192-199_

```ts
  } catch (err) {
    console.error(err);
    if (catId !== null) {
      await db.delete(cats).where(eq(cats.id, catId));
      await deleteCatPhotos(keys);
    }
    return { ok: false, error: "Couldn't save the cat. Please try again." };
  }
```

- **Line 193** log the real error.
- **Lines 194-197** if a listing row was created (`catId !== null`), undo: delete the `cats` row (the **cascade** deletes any `cat_images` rows) and delete the keys from R2 (best-effort, Chapter 7.3). `deleteCatPhotos` is safe to call even for keys that were never uploaded: deleting a missing key is not an error.
- **Line 198** the user only sees a generic message.

> **A subtle edge case.** `Promise.all` rejects as soon as _one_ upload fails, but the other uploads that are already in flight are **not cancelled**. They can finish _after_ the cleanup's `deleteCatPhotos` has run, leaving an orphaned object in the bucket. It costs a little storage and is invisible to users. If you ever want to close this gap, wait for _all_ uploads to settle first (`Promise.allSettled`) and clean up after.

## 12.10 Finishing

_app/(pages)/add_a_cat/actions.ts, lines 201-204_

```ts
  after(purgeExpiredListings);
  // Must stay outside the try/catch: redirect() works by throwing.
  redirect("/");
}
```

- **Line 201** `after(purgeExpiredListings)`: schedule the expiry cleanup (Chapter 15) to run after the response, so the user is not kept waiting. It is passed as a function; `after` calls it later.
- **Lines 202-203** `redirect("/")` goes to the home page. The comment reminds you that it **must stay outside the `try/catch`**, because it works by throwing (Chapter 3.9).

## 12.11 What happens at each failure point

| Failure                                                   | What exists at that moment               | Result                                                                          |
| --------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| Not logged in / bad field / bad photo                     | Nothing                                  | Error returned, nothing to clean                                                |
| 3 id collisions in a row                                  | Nothing                                  | `catch`, `catId === null`, no cleanup needed                                    |
| One upload fails                                          | `cats` row, some objects                 | `catch`: delete row + delete all keys. Slow in-flight uploads may be orphaned   |
| `cat_images` insert fails                                 | `cats` row, all objects                  | `catch`: delete row + delete all keys                                           |
| Server crashes between steps 5 and 7                      | `cats` row and maybe objects, no cleanup | A listing with no photos (shows "No photo yet"), possible orphan objects        |
| Cleanup itself fails (`db.delete` throws, R2 unreachable) | Leftovers                                | R2 errors are logged; a failing `db.delete` would surface as an unhandled error |

None of the "leftover" cases is dangerous: at worst, wasted storage or a listing without a photo. Because the unique `public_id` is claimed first, no case can overwrite someone else's photo. The expiry job also removes old listings along with their keys (Chapter 15).

## Chapter 12 quiz

1. Why is the row inserted **before** the photos are uploaded?
2. What does `.onConflictDoNothing(...).returning(...)` return when the id is already taken?
3. What would happen if `redirect("/")` were placed inside the `try` block?
4. Why does the server check `isWebp` if the browser already converted to WebP?
5. Why is `deleteCatPhotos(keys)` safe after a partial upload failure?
6. Where does position 0 (the cover) get its key number?
7. What are the two ways the server defends against huge uploads?

<details>
<summary>Show answers</summary>

1. The unique `public_id` is claimed first, so we know the keys are ours and cannot overwrite another listing's photos (because `PutObject` overwrites silently).
2. An empty list, so `cat` is `undefined`, `catId` stays `null`, and the loop retries with a new id.
3. The `catch` would swallow the redirect error, so the user would see "Couldn't save the cat" after a successful save.
4. The browser can be bypassed; anyone can call the server action directly. The server must not trust it.
5. Deleting keys that do not exist is not an error in S3's `DeleteObjects`, and the delete function never throws anyway.
6. `catPhotoKey(publicId, i + 1)` with `i = 0` gives `-1.webp`. Key numbers start at 1; `position` starts at 0.
7. The per-photo limit of 1.25 MiB (`MAX_STORED_SIZE_BYTES`) and the 5-photo limit (`MAX_IMAGES`), on top of Next.js's overall request cap (`bodySizeLimit`, 20 MB).

</details>
***

# Chapter 13: Showing photos

The database stores **keys**. Pages need **URLs**. `lib/cats.ts` is where the two meet. It is a **server-only** file (it starts with `import "server-only"`, so importing it from a client component is a build error).

## 13.1 Imports

_lib/cats.ts, lines 1-23_

```ts
import "server-only";

import { cache } from "react";
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  inArray,
  ilike,
  or,
  lte,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import { catImages, cats, user } from "@/db/schema";
import { MAX_FILTER_AGE, type CatFilters } from "@/lib/cat-filters";
import { isLiveListing, listingSecondsLeft } from "@/lib/listing-expiry";
import { isPublicId } from "@/lib/public-id";
import { catPhotoUrl } from "@/lib/uploads";
```

- **Line 1** `import "server-only"` makes the file un-importable from browser code.
- **Line 3** `cache` from React is used once, in `getCat`.
- **Lines 4-17** query helpers from Drizzle (`eq`, `asc`, `inArray` ...). Most are used by the search filters, which are not about images.
- **Lines 18-19** the database client and tables (`catImages` is the one we care about).
- **Line 21** `isLiveListing`: "created less than 3 months ago" (Chapter 15). **Line 23** `catPhotoUrl` turns a key into a URL (Chapter 6).

## 13.2 Selecting the cover key

_lib/cats.ts, lines 27-39_

```ts
// R2 key of a listing's cover photo; withCoverUrl turns it into a public URL.
const coverImageKey = sql<string | null>`(
  select ${catImages.key} from ${catImages}
  where ${catImages.catId} = ${cats.id}
  order by ${catImages.position} asc, ${catImages.id} asc limit 1
)`;

function withCoverUrl<T extends { coverImageKey: string | null }>({
  coverImageKey: key,
  ...row
}: T) {
  return { ...row, coverImageUrl: key ? catPhotoUrl(key) : null };
}
```

**Example explained**

- **Lines 28-32** a **correlated subquery** written with Drizzle's `sql` template: for each cat row, "select the `key` from `cat_images` where `cat_id` matches this cat, ordered by `position` (then `id` as a tiebreaker), and take the first". So you get the **cover photo's key**, or `NULL` if the cat has no photos, in the same query as the cat itself. `${catImages.key}` inserts a column reference safely.
- The query returns a **key**, not a URL, because the URL depends on an environment variable. Building it in JavaScript (next function) keeps SQL independent of configuration.
- **Lines 34-39** `withCoverUrl` post-processes a row. `T extends { coverImageKey: string | null }` is a **generic constraint**: it accepts any row shape as long as it contains that field. The parameter `{ coverImageKey: key, ...row }` **destructures**: it pulls `coverImageKey` out under the local name `key` and gathers **all other fields** into `row`. It returns `{ ...row, coverImageUrl: ... }`, so the key disappears from the result and a ready-to-use `coverImageUrl` appears (or `null` when there is no photo).

## 13.3 Listing queries

_lib/cats.ts, lines 41-58_

```ts
export async function getFeaturedCats() {
  const rows = await db
    .select({
      publicId: cats.publicId,
      name: cats.name,
      breed: cats.breed,
      ageMonths: cats.ageMonths,
      gender: cats.gender,
      area: cats.area,
      district: cats.district,
      coverImageKey,
    })
    .from(cats)
    .where(and(eq(cats.status, "available"), isLiveListing))
    .orderBy(sql`random()`)
    .limit(3);
  return rows.map(withCoverUrl);
}
```

`getFeaturedCats` (home page): `coverImageKey` is one of the selected columns (line 51). ``.orderBy(sql`random()`)`` and `.limit(3)` pick three random available, live cats. `rows.map(withCoverUrl)` converts every row.

_lib/cats.ts, lines 109-138_

```ts
  const [items, totals] = await Promise.all([
    db
      .select({
        publicId: cats.publicId,
        name: cats.name,
        breed: cats.breed,
        ageMonths: cats.ageMonths,
        gender: cats.gender,
        area: cats.area,
        district: cats.district,
        status: cats.status,
        owner: { id: user.id, name: user.name },
        coverImageKey,
      })
      .from(cats)
      .innerJoin(user, eq(cats.userId, user.id))
      .where(filter)
      .orderBy(desc(cats.createdAt), desc(cats.id))
      .limit(CATS_PER_PAGE)
      .offset(offset),
    db.select({ total: count() }).from(cats).where(filter),
  ]);
  const total = totals[0].total;
  return {
    items: items.map(withCoverUrl),
    total,
    page: requestedPage,
    totalPages: Math.ceil(total / CATS_PER_PAGE),
  };
}
```

`getCats` (Find a Cat page): the first query (lines 110-128) selects the page of cats **including `coverImageKey`** (line 121), while the second runs a count in parallel with `Promise.all`. The result's `items` are mapped through `withCoverUrl` (line 133). (The `filter` built before line 108 is the search/filter logic and is not about images.)

_lib/cats.ts, lines 149-184_

```ts
// Wrapped in React `cache()` so `generateMetadata` and the page body share one
// DB read per request (request-scoped memoization, not cross-request caching).
export const getCat = cache(async (publicId: string) => {
  if (!isPublicId(publicId)) return null;
  const [cat] = await db
    .select({
      ...getTableColumns(cats),
      // Only whether a number exists: the number itself is sent by the
      // contact action on tap, never rendered into the page.
      owner: {
        id: user.id,
        name: user.name,
        hasPhone: sql<boolean>`${user.phone} is not null`,
      },
    })
    .from(cats)
    .innerJoin(user, eq(cats.userId, user.id))
    .where(and(eq(cats.publicId, publicId), isLiveListing))
    .limit(1);
  if (!cat) return null;
  const rows = await db
    .select({
      id: catImages.id,
      key: catImages.key,
      caption: catImages.caption,
      position: catImages.position,
    })
    .from(catImages)
    .where(eq(catImages.catId, cat.id))
    .orderBy(asc(catImages.position), asc(catImages.id));
  const images = rows.map(({ key, ...image }) => ({
    ...image,
    url: catPhotoUrl(key),
  }));
  return { ...cat, images, coverImageUrl: images[0]?.url ?? null };
});
```

**Example explained**

- **Lines 149-151** `getCat(publicId)` wrapped in React's `cache()`. It makes the page and its `generateMetadata` share one database read per request.
- **Line 152** `if (!isPublicId(publicId)) return null;`: validates the id before it touches the database.
- **Lines 153-167** the cat itself (with the owner's name). The `.where(and(eq(cats.publicId, publicId), isLiveListing))` returns nothing if the listing has expired.
- **Lines 169-178** all photos of that cat, **ordered by `position`**: `catImages.key`, `caption`, `position` and `id`.
- **Lines 179-182** `rows.map(({ key, ...image }) => ({ ...image, url: catPhotoUrl(key) }))`: remove `key`, add `url`. The same destructuring trick as `withCoverUrl`.
- **Line 183** returns the cat plus its `images` and `coverImageUrl` (the first image's URL, if any: `images[0]?.url ?? null`).

_lib/cats.ts, lines 198-217_

```ts
// Everything someone has listed that hasn't expired yet, newest first.
export async function getUserCats(userId: string) {
  const rows = await db
    .select({
      publicId: cats.publicId,
      name: cats.name,
      breed: cats.breed,
      ageMonths: cats.ageMonths,
      gender: cats.gender,
      area: cats.area,
      district: cats.district,
      status: cats.status,
      secondsLeft: listingSecondsLeft,
      coverImageKey,
    })
    .from(cats)
    .where(and(eq(cats.userId, userId), isLiveListing))
    .orderBy(desc(cats.createdAt), desc(cats.id));
  return rows.map(withCoverUrl);
}
```

`getUserCats` (profile page): the same pattern for "my listings": `coverImageKey` selected on line 211, mapped on line 216.

> **Pattern to remember:** database → **key** → `catPhotoUrl(key)` → URL → component. No page ever sees a key, and no query ever stores a URL.

## 13.4 The components

_components/view/cat/CatCard.tsx, lines 62-84_

```tsx
      {cat.coverImageUrl ? (
        <Image
          className={cn(catImage, imageClassName)}
          src={cat.coverImageUrl}
          alt={cat.name}
          width={672}
          height={400}
          sizes={sizes}
          unoptimized
        />
      ) : (
        <div
          className={cn(
            catImage,
            "grid flex-none place-items-center text-muted-foreground",
            imageClassName,
          )}
          role="img"
          aria-label="No photo yet"
        >
          <Cat size={42} aria-hidden="true" />
        </div>
      )}
```

- If the cat has a `coverImageUrl`, render `<Image src={...} alt={cat.name} width={672} height={400} sizes={sizes} unoptimized />`. With `unoptimized` the browser requests the R2 URL directly (Chapter 3.10). `width`/`height` reserve space to avoid layout jumps. `sizes` is a hint about the display width.
- Otherwise (lines 72-83) draw a placeholder `<div>` with a cat icon and `role="img"` plus `aria-label="No photo yet"` so screen readers announce it.

_app/(pages)/find_a_cat/[publicId]/page.tsx, lines 77-108_

```tsx
        {cat.images.length > 0 ? (
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            {cat.images.map((image, index) => (
              <figure
                key={image.id}
                className={index === 0 ? "sm:col-span-2" : ""}
              >
                <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-muted">
                  <Image
                    src={image.url}
                    alt={image.caption || cat.name}
                    fill
                    unoptimized
                    sizes={
                      index === 0
                        ? "(min-width: 1024px) 55vw, 100vw"
                        : "(min-width: 1024px) 27vw, (min-width: 640px) 50vw, 100vw"
                    }
                    className="object-contain"
                  />
                </div>
                {image.caption ? (
                  <figcaption className="mt-2 text-sm text-muted-foreground">
                    {image.caption}
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No photos yet.</p>
        )}
```

- **Line 77** if the listing has photos, show them in a grid; otherwise (line 107) "No photos yet."
- **Lines 79-97** one `<figure>` per photo. The first (cover) spans two columns on wider screens (`index === 0 ? "sm:col-span-2" : ""`). The wrapper has a fixed `aspect-[16/10]` ratio and `relative` positioning so `fill` works. `alt={image.caption || cat.name}`: use the caption as alt text when there is one. `className="object-contain"` shows the **whole** photo without cropping (the card, by contrast, uses `object-cover`).
- **Lines 98-102** the optional caption in a `<figcaption>`.

> **A performance note:** the card shows an image about 672 × 400 px but loads the full file (up to 1600 px, up to 1 MiB). Because the app uses `unoptimized` there is no resizing. The CDN makes repeat loads cheap, but first loads on a slow connection carry the full size. A smaller "thumbnail" variant is a possible improvement (Chapter 19).

## Chapter 13 quiz

1. Why does the SQL select a **key** and not a URL?
2. What does `({ coverImageKey: key, ...row })` do?
3. How does the app decide which photo is the cover?
4. What does `catPhotoUrl` throw when `R2_PUBLIC_URL` is missing, and when would you notice?
5. Why does `getCat` validate the id with `isPublicId`?

<details>
<summary>Show answers</summary>

1. The URL depends on `R2_PUBLIC_URL`, which is configuration. Keeping the database to keys means the domain can change without a data migration.
2. It takes `coverImageKey` out of the object under the name `key` and collects all the other fields into `row`. The returned object then has no key, only the new `coverImageUrl`.
3. The photo with the lowest `position` (ties broken by `id`).
4. It throws `R2_PUBLIC_URL is not set`, the first time any page tries to build a photo URL (for example the home page).
5. A value from the URL is untrusted; the check stops malformed ids reaching the database query at all.

</details>

---

# Chapter 14: Deleting a listing

File: `app/(pages)/find_a_cat/[publicId]/delete-actions.ts` (a server action).

An owner presses delete. Three things must disappear: the `cats` row, its `cat_images` rows, and the R2 objects.

_app/(pages)/find_a_cat/[publicId]/delete-actions.ts, lines 1-21_

```ts
"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { catImages, cats } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { deleteCatPhotos } from "@/lib/cloudflareR2";
import { isPublicId } from "@/lib/public-id";
import { isCatPhotoKey } from "@/lib/uploads";

type DeleteResult = { ok: true } | { ok: false; error: string };

export async function deleteCatListing(
  publicId: string,
): Promise<DeleteResult> {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "Please log in first." };
  if (!isPublicId(publicId)) {
    return { ok: false, error: "Invalid listing." };
  }
```

- **Lines 3-10** imports. `revalidatePath` (line 4) tells Next.js to discard cached pages.
- **Line 12** the result type.
- **Lines 14-16** the action takes a `publicId` (never the sequential id).
- **Lines 17-18** must be logged in.
- **Lines 19-21** `isPublicId(publicId)` guards the input. Because this is a server action, `publicId` can be _anything_ a caller sends, even though the TypeScript type says `string`. TypeScript types are erased at runtime.

_app/(pages)/find_a_cat/[publicId]/delete-actions.ts, lines 23-49_

```ts
  const ownedListing = and(
    eq(cats.publicId, publicId),
    eq(cats.userId, session.user.id),
  );
  let images: { key: string }[];
  try {
    images = await db
      .select({ key: catImages.key })
      .from(catImages)
      .innerJoin(cats, eq(catImages.catId, cats.id))
      .where(ownedListing);
    // Check ownership in the mutation itself, including concurrent requests.
    // Related image records are removed by the database's cascading foreign key.
    const deleted = await db
      .delete(cats)
      .where(ownedListing)
      .returning({ id: cats.id });
    if (deleted.length === 0) {
      return { ok: false, error: "Listing not found or you don't own it." };
    }
  } catch (error) {
    console.error("Couldn't delete listing", error);
    return {
      ok: false,
      error: "Couldn't delete the listing. Please try again.",
    };
  }
```

**Example explained**

- **Lines 23-26** `ownedListing` is one `where` condition: `public_id = <the id> AND user_id = <the session user>`. It is used **twice** (lines 33 and 38). The ownership check is **part of the SQL**, not a separate `if`, so there is no window between "check owner" and "delete" in which something could change.
- **Line 27** `images` is declared outside the `try` so it is available afterwards.
- **Lines 29-33** first, **read the keys**. We must read them _before_ deleting: after the cat is deleted, the cascade removes the `cat_images` rows and the keys would be gone. `innerJoin` connects photos to their cat so we can filter by public id and owner.
- **Lines 36-39** delete the cat. `.returning({ id: cats.id })` returns the deleted rows.
- **Lines 40-42** **nothing deleted** means the listing does not exist, is not yours, or was deleted a moment ago by someone else. Return an error and **do not touch R2**.
- **Lines 43-49** a database failure: log, return an error, and again leave the photos alone. The listing is still there, so its photos must stay.

_app/(pages)/find_a_cat/[publicId]/delete-actions.ts, lines 51-65_

```ts
  // Only this listing's own photo keys (cats/<publicId>-<n>.webp) are removed
  // from R2.
  await deleteCatPhotos(
    images
      .map(({ key }) => key)
      .filter(
        (key) => isCatPhotoKey(key) && key.startsWith(`cats/${publicId}-`),
      ),
  );

  revalidatePath("/");
  revalidatePath("/find_a_cat");
  revalidatePath(`/find_a_cat/${publicId}`);
  return { ok: true };
}
```

- **Lines 51-59** only now delete from R2, and only keys that pass **two** tests: `isCatPhotoKey(key)` (well-formed) **and** ``key.startsWith(`cats/${publicId}-`)`` (belongs to _this_ listing). Even if a database row held a strange key, the app could not be tricked into deleting another listing's photos. `deleteCatPhotos` never throws (Chapter 7.3).
- **Lines 61-63** refresh the cached pages that might have shown this cat: the home page, the list page, and its own page.
- **Line 64** report success.

> **Why database first, R2 second?** If you deleted the photos first and the database delete then failed, you would have a live listing with broken images. Done in this order, the worst case is a few leftover objects that nobody can reach through the app.

## Chapter 14 quiz

1. Why are the keys read _before_ the delete?
2. Why is the owner check inside the SQL `where` instead of an `if`?
3. What happens to R2 if the database delete fails?
4. Which two conditions must a key meet to be deleted from R2?
5. What does `revalidatePath` do?

<details>
<summary>Show answers</summary>

1. The cascade deletes the `cat_images` rows together with the cat; afterwards the keys are no longer known.
2. The check and the change are one atomic statement, so there is no gap in which ownership or existence could change.
3. Nothing is deleted from R2; the function returns before that step.
4. It must match the strict key pattern and start with `cats/<this listing's id>-`.
5. It marks the cached output of those pages as stale so the next visit fetches fresh data.

</details>

---

# Chapter 15: Expiring old listings

File: `lib/listing-expiry.ts` (server only).

Listings live for **3 months**. After that they are hidden immediately and deleted lazily, together with their photos.

_lib/listing-expiry.ts, lines 1-17_

```ts
import "server-only";

import { eq, gt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { catImages, cats } from "@/db/schema";
import { deleteCatPhotos } from "@/lib/cloudflareR2";
import { isCatPhotoKey } from "@/lib/uploads";

// Every listing, with its photos, is deleted this long after it was posted.
export const LISTING_LIFETIME_MONTHS = 3;

// Worked out in the database so every server agrees on "now".
const lifetime = sql`make_interval(months => ${LISTING_LIFETIME_MONTHS})`;
const cutoff = sql`now() - ${lifetime}`;
export const isLiveListing = gt(cats.createdAt, cutoff);
const isExpiredListing = lte(cats.createdAt, cutoff);
export const listingSecondsLeft = sql<number>`floor(extract(epoch from (${cats.createdAt} + ${lifetime} - now())))::int`;
```

**Example explained**

- **Lines 3-7** imports: Drizzle helpers, the database, tables, `deleteCatPhotos` and `isCatPhotoKey`.
- **Line 10** the lifetime constant.
- **Lines 12-13** two SQL fragments built with the `sql` tag: `lifetime` = `make_interval(months => 3)` (a Postgres interval) and `cutoff` = `now() - lifetime`. **`now()` is evaluated by the database**, so every server instance agrees on the time, no matter what its own clock says.
- **Line 15** `isLiveListing = gt(cats.createdAt, cutoff)`: "created after the cutoff". Every read uses this, so expired listings vanish from every page the instant they expire.
- **Line 16** `isExpiredListing = lte(cats.createdAt, cutoff)`: the opposite, used only by the purge.
- **Line 17** `listingSecondsLeft`: the seconds until expiry, computed in SQL (`extract(epoch from ...)` converts an interval to seconds).

_lib/listing-expiry.ts, lines 19-26_

```ts
// "in 3 days", "in 5 hours", "within the hour"
export function formatTimeLeft(secondsLeft: number) {
  const hours = Math.floor(secondsLeft / 3600);
  if (hours < 1) return "within the hour";
  if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}
```

`formatTimeLeft` turns seconds into text such as "in 3 days", "in 5 hours" or "within the hour". Not about images.

_lib/listing-expiry.ts, lines 28-56_

```ts
// Reads already hide expired listings via isLiveListing; this removes their
// rows and photos. Called with after() on busy pages, so it is throttled per
// server instance rather than run on every request.
const PURGE_EVERY_MS = 10 * 60 * 1000;
let lastPurgeAt = 0;

export async function purgeExpiredListings() {
  if (Date.now() - lastPurgeAt < PURGE_EVERY_MS) return;
  lastPurgeAt = Date.now();
  try {
    const images = await db
      .select({ key: catImages.key })
      .from(catImages)
      .innerJoin(cats, eq(catImages.catId, cats.id))
      .where(isExpiredListing);
    // Photo rows go with their listing through the cascading foreign key.
    const deleted = await db
      .delete(cats)
      .where(isExpiredListing)
      .returning({ id: cats.id });
    if (deleted.length === 0) return;
    // Only well-formed photo keys are sent to R2.
    await deleteCatPhotos(images.map(({ key }) => key).filter(isCatPhotoKey));
    console.log(`Removed ${deleted.length} expired cat listing(s).`);
  } catch (error) {
    lastPurgeAt = 0; // try again on the next request
    console.error("Couldn't remove expired listings", error);
  }
}
```

**Example explained**

- **Lines 28-30** the comment: reads already hide expired listings; this function frees the space. It runs through `after()` on busy pages, so it is throttled.
- **Line 31** `PURGE_EVERY_MS` = 10 minutes (10 × 60 × 1000 ms).
- **Line 32** `let lastPurgeAt = 0;`: a **module-level variable**. It lives in the server process's memory, so each server instance throttles on its own. There is no shared lock and no cron job.
- **Line 35** if less than 10 minutes have passed, return immediately.
- **Line 36** record the time **before** doing the work, so two overlapping requests do not both start a purge.
- **Lines 38-42** select the keys of photos whose listing is expired. (This must happen before the delete, for the same reason as in Chapter 14.)
- **Line 43** the comment: the photo **rows** go automatically (cascade).
- **Lines 44-47** delete every expired cat and get back the list of deleted rows.
- **Line 48** if none were deleted, there is nothing more to do.
- **Lines 49-50** delete the R2 objects, and **filter with `isCatPhotoKey`** so only well-formed keys are ever sent. Unlike the single-listing delete, this one cannot use a per-listing prefix check because it handles many listings at once.
- **Line 51** log how many listings were removed.
- **Lines 52-55** if anything threw, **reset `lastPurgeAt = 0`** so the next request tries again, and log the error.

> **Where is it called?** `after(purgeExpiredListings)` runs at the end of `submitForm` (Chapter 12.10), and on the Find a Cat and signed-in Profile pages. If nobody ever visits those, nothing is purged, which is acceptable because reads already hide expired listings.

## Chapter 15 quiz

1. Why is `now()` computed in SQL and not with `Date.now()`?
2. What is the difference between `isLiveListing` and the purge?
3. Why is `lastPurgeAt` set at the start of the work, but reset to 0 on error?
4. A listing expires at 10:00. At 10:01 someone opens its photo's direct URL. Does it still load?
5. Why does the purge not use a per-listing prefix check?

<details>
<summary>Show answers</summary>

1. So all servers share one clock (the database's). Instances with a wrong clock would disagree about what is expired.
2. `isLiveListing` _hides_ expired listings from queries instantly. The purge _deletes_ rows and photos later.
3. Setting it first prevents overlapping purges; resetting on error lets the next request retry instead of waiting 10 minutes.
4. Probably yes, until the next purge deletes the object (and a CDN copy may last a little longer).
5. It deletes photos for many listings at once; a single listing's prefix would not apply. It relies on the strict `isCatPhotoKey` pattern instead.

</details>

---

# Chapter 16: Setup and the `r2:check` script

## 16.1 Setting up from scratch

Detailed steps are in [`README.md`](README.md) in this folder. In short:

1. **Cloudflare dashboard → R2 → Create bucket.**
2. **Create an API token** with _Object Read & Write_ scoped to that bucket. Copy the Access Key ID, the Secret Access Key, and the S3 endpoint.
3. **Turn on public access** (Door 2): the r2.dev Public Development URL for testing, or a Custom Domain for production. No CORS rule is needed, because photos are loaded by `<img>` tags, not by JavaScript `fetch`.
4. Put the five variables from Chapter 4 into `.env`.
5. Apply the database migrations (Chapter 8) by running the SQL files.
6. Run `npm run r2:check`.

> **Why no CORS?** CORS (_Cross-Origin Resource Sharing_) rules decide whether JavaScript on one website may read responses from another. A plain `<img src>` is not subject to those rules. If you ever fetch photos with `fetch()` or draw them into a `<canvas>` from another origin, you would need a CORS rule on the bucket.

## 16.2 The `r2:check` script

`npm run r2:check` runs `tsx scripts/check-r2.ts` (see `package.json`). **`tsx`** is a tool that runs TypeScript files directly with Node.js. The script is an end-to-end test of the setup using the real bucket.

_scripts/check-r2.ts, lines 1-7_

```ts
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { deleteCatPhotos, putCatPhoto } from "../lib/cloudflareR2";

// End-to-end check of the R2 setup, run with `npm run r2:check`:
// upload through the S3 API -> read back from R2_PUBLIC_URL (what browsers
// use) -> delete. Exits non-zero with the reason if any step fails.
```

- **Line 1** `import "dotenv/config"` loads `.env` into `process.env` (Next.js does that for you, but plain Node does not).
- **Line 2** `randomBytes` for a random test key name.
- **Line 3** a **relative** import of the real production functions: the script tests the code the app really uses.

_scripts/check-r2.ts, lines 9-17_

```ts
// A valid 1x1 WebP.
const PIXEL = Buffer.from(
  "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=",
  "base64",
);

function fail(message: string): never {
  throw new Error(message);
}
```

- **Lines 10-13** `PIXEL` is a tiny valid 1×1 WebP, stored as **base64** text and decoded with `Buffer.from(..., "base64")`.
- **Lines 15-17** `fail(message): never` throws. The return type `never` tells TypeScript that the function does not return, so code after a `fail(...)` call is known to be unreachable.

_scripts/check-r2.ts, lines 19-34_

```ts
async function main() {
  for (const name of [
    "CLOUDFLARE_R2_ENDPOINT",
    "CLOUDFLARE_R2_ACCESS_KEY",
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    "CLOUDFLARE_R2_BUCKET",
    "R2_PUBLIC_URL",
  ]) {
    if (!process.env[name]) fail(`${name} is not set`);
  }
  const base = process.env.R2_PUBLIC_URL!.replace(/\/+$/, "");
  const key = `cats/_check-${randomBytes(6).toString("hex")}.webp`;
  const url = `${base}/${key}`;

  console.log(`1/3 upload ${key}`);
  await putCatPhoto(key, PIXEL);
```

- **Lines 20-28** loops over the five required variable names and fails clearly if any is missing (the check Chapter 4.3 said was missing elsewhere).
- **Line 29** strips trailing slashes from `R2_PUBLIC_URL`.
- **Line 30** a test key like `cats/_check-9f2a6c01d3be.webp`. It starts with an underscore, so it does **not** match the real key pattern (`isCatPhotoKey`). It can never collide with a real listing's photo.
- **Line 31** the public URL for it.
- **Lines 33-34** **step 1: upload** with `putCatPhoto`: the real function, over Door 1.

_scripts/check-r2.ts, lines 36-55_

```ts
  try {
    console.log(`2/3 fetch ${url}`);
    const res = await fetch(url, { cache: "no-store" });
    if (res.status !== 200) {
      fail(
        `public URL returned ${res.status}. Is public access (custom domain or r2.dev URL) enabled, and does R2_PUBLIC_URL point at it?`,
      );
    }
    const type = res.headers.get("content-type");
    if (type !== "image/webp") fail(`content-type was ${type}`);
    const cacheControl = res.headers.get("cache-control") ?? "";
    if (!cacheControl.includes("immutable")) {
      fail(`cache-control was "${cacheControl}"`);
    }
    const body = Buffer.from(await res.arrayBuffer());
    if (!body.equals(PIXEL)) fail("downloaded bytes don't match the upload");
  } finally {
    console.log("3/3 delete");
    await deleteCatPhotos([key]);
  }
```

- **Step 2: fetch it over Door 2**, exactly like a browser. `cache: "no-store"` stops Node from caching.
- **Lines 39-43** must be HTTP 200; otherwise the error message tells you the likely cause (public access not enabled, or `R2_PUBLIC_URL` wrong). This is the most common setup mistake (Chapter 2.4).
- **Lines 44-49** the `content-type` header must be exactly `image/webp`, and `cache-control` must contain `immutable`. This confirms the metadata set in `putCatPhoto` is really served.
- **Lines 50-51** reads the bytes (`arrayBuffer()` → `Buffer`) and compares with the original (`Buffer.equals`).
- **Lines 52-55** `finally`: **step 3: delete** always runs, even if a check failed, so test objects are not left behind.

_scripts/check-r2.ts, lines 57-67_

```ts
  // A cached copy may linger on the CDN briefly; retry before complaining.
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${url}?gone=${attempt}`, { cache: "no-store" });
    if (res.status === 404) {
      console.log("R2 OK: upload, public read and delete all work.");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  fail("object is still publicly reachable after delete");
}
```

- After deleting, confirm the object is really gone. A CDN may still hold a cached copy for a moment, so it retries up to 5 times, 2 seconds apart.
- **Line 59** `?gone=${attempt}` adds a different query string on every attempt. CDNs usually treat each distinct URL as a separate cache entry, so this bypasses a cached copy and asks the origin.
- **Line 60-62** a 404 means success: print the all-clear and `return`.
- **Line 64** `await new Promise(resolve => setTimeout(resolve, 2000))` is the standard way to "sleep" in JavaScript.
- **Line 66** if still reachable after 5 tries, fail.

_scripts/check-r2.ts, lines 69-72_

```ts
main().catch((error) => {
  console.error(`R2 check failed: ${error.message ?? error}`);
  process.exit(1);
});
```

- `main().catch(...)`: since top-level `await` is avoided, the script runs `main()` and handles any rejection: print the message and `process.exit(1)`. A **non-zero exit code** is how command-line tools tell a shell (or a CI system) "this failed".

## Chapter 16 quiz

1. Which two "doors" does `r2:check` exercise?
2. Why does the test key start with `_check-`?
3. What does `process.exit(1)` signal?
4. Why does the script add `?gone=` to the URL?
5. Why is public access to the bucket required for photos to appear, but CORS is not?

<details>
<summary>Show answers</summary>

1. Door 1 (upload and delete through the S3 API) and Door 2 (public read through `R2_PUBLIC_URL`).
2. It does not match `isCatPhotoKey`, so it can never be mistaken for, or collide with, a real listing photo.
3. Failure: a non-zero exit code.
4. To bypass a CDN copy; each new query string looks like a new URL.
5. Anyone loading an `<img>` must be allowed to read the object (public access). CORS only matters when JavaScript reads cross-origin responses.

</details>

---

# Chapter 17: The tests

Run everything with `npm run test`. There are **two runners** (see `AGENTS.md`):

| Runner                            | Files              | Used for                                                        |
| --------------------------------- | ------------------ | --------------------------------------------------------------- |
| **Vitest**                        | `lib/*.test.ts`    | Pure functions: ids, keys, URLs                                 |
| **Node's built-in `node --test`** | `tests/*.test.mjs` | Server actions, with fake database and fake R2 injected by hand |

## 17.1 `lib/uploads.test.ts`

_lib/uploads.test.ts, lines 1-49_

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { catPhotoKey, catPhotoUrl, isCatPhotoKey, isWebp } from "./uploads";

afterEach(() => vi.unstubAllEnvs());

describe("catPhotoKey / isCatPhotoKey", () => {
  it("builds keys the checker accepts", () => {
    for (let n = 1; n <= 5; n++) {
      expect(isCatPhotoKey(catPhotoKey("gj34jfxk", n))).toBe(true);
    }
    expect(catPhotoKey("gj34jfxk", 1)).toBe("cats/gj34jfxk-1.webp");
  });

  it("rejects anything else", () => {
    for (const key of [
      "cats/gj34jfxk-0.webp",
      "cats/gj34jfxk-6.webp",
      "cats/gj34jfx-1.webp",
      "cats/GJ34JFXK-1.webp",
      "cats/gj34jfxk-1.png",
      "cats/../gj34jfxk-1.webp",
      "gj34jfxk-1.webp",
      "user/1b2c.webp",
    ]) {
      expect(isCatPhotoKey(key)).toBe(false);
    }
  });
});

describe("catPhotoUrl", () => {
  it("joins the public R2 domain and key", () => {
    vi.stubEnv("R2_PUBLIC_URL", "https://img.example.com/");
    expect(catPhotoUrl("cats/gj34jfxk-2.webp")).toBe(
      "https://img.example.com/cats/gj34jfxk-2.webp",
    );
  });

  it("fails loudly without R2_PUBLIC_URL", () => {
    vi.stubEnv("R2_PUBLIC_URL", "");
    expect(() => catPhotoUrl("cats/gj34jfxk-1.webp")).toThrow(/R2_PUBLIC_URL/);
  });
});

describe("isWebp", () => {
  it("checks the RIFF/WEBP header", () => {
    expect(isWebp(Buffer.from("RIFF\0\0\0\0WEBPVP8 "))).toBe(true);
    expect(isWebp(Buffer.from("\x89PNG\r\n\x1a\n0000000"))).toBe(false);
  });
});
```

**Example explained**

- **Line 1-2** `describe` groups tests, `it` defines one, `expect` makes assertions, `afterEach` runs after every test, `vi` is vitest's toolbox for fakes.
- **Line 4** `afterEach(() => vi.unstubAllEnvs())` removes any fake environment variables after each test so tests do not affect each other.
- **Lines 6-12** builds keys for `n = 1..5`, asserts each passes `isCatPhotoKey`, and checks one exact value.
- **Lines 14-27** the **negative tests**: keys that must be rejected: number out of range, wrong length, uppercase, wrong extension, `..` path tricks, missing folder prefix, wrong folder. These are exactly the things the regex's anchors and character classes protect against.
- **Lines 30-36** `vi.stubEnv` fakes `R2_PUBLIC_URL`; asserts the trailing slash is handled and the URL is right.
- **Lines 38-41** with an empty `R2_PUBLIC_URL`, `catPhotoUrl` must throw, and `toThrow(/R2_PUBLIC_URL/)` checks the message.
- **Lines 44-49** `isWebp` accepts a buffer starting `RIFF....WEBP` and rejects a PNG header.

## 17.2 `lib/public-id.test.ts`

_lib/public-id.test.ts, lines 1-39_

```ts
import { describe, expect, it } from "vitest";
import { isPublicId, newPublicId } from "./public-id";

describe("newPublicId", () => {
  it("makes 8 lowercase letters and digits", () => {
    for (let i = 0; i < 200; i++) {
      expect(newPublicId()).toMatch(/^[a-z0-9]{8}$/);
    }
  });

  it("doesn't repeat itself", () => {
    const ids = new Set(Array.from({ length: 1000 }, newPublicId));
    expect(ids.size).toBe(1000);
  });
});

describe("isPublicId", () => {
  it("accepts valid ids", () => {
    expect(isPublicId("gj34jfxk")).toBe(true);
    expect(isPublicId("00000000")).toBe(true);
  });

  it("rejects everything else", () => {
    for (const value of [
      "",
      "gj34jfx",
      "gj34jfxkk",
      "GJ34JFXK",
      "gj34-fxk",
      "../../../",
      "12",
      12345678,
      null,
      undefined,
    ]) {
      expect(isPublicId(value)).toBe(false);
    }
  });
});
```

- The first test generates 200 ids and checks each against the pattern. The second generates 1000 and puts them in a `Set` (which stores only unique values), so if any two matched, the size would be below 1000. It is a statistical check (collisions are possible but astronomically unlikely).
- `isPublicId` accepts valid ids and rejects a list of bad values: wrong length, uppercase, a dash, path traversal (`../../../`), numbers, `null`, `undefined`.

## 17.3 `tests/delete-listing.test.mjs`

This test runs the **real** `delete-actions.ts` code, but replaces its dependencies (database, auth, R2, `revalidatePath`) with hand-written fakes. The file also tests the delete **button** at its end (lines 163-208), which is a user-interface test and outside the image system, so only the first part is shown.

_tests/delete-listing.test.mjs, lines 1-161_

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import { PgDialect } from "drizzle-orm/pg-core";

const runtimeRequire = createRequire(import.meta.url);

function load(file, mocks = {}, globals = {}) {
  const testModule = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  vm.runInNewContext(code, {
    module: testModule,
    exports: testModule.exports,
    console: { error() {} },
    ...globals,
    require: (name) => (name in mocks ? mocks[name] : runtimeRequire(name)),
  });
  return testModule.exports;
}

const schema = load("db/schema.ts");
const publicIdModule = load("lib/public-id.ts");
const uploadsModule = load(
  "lib/uploads.ts",
  {
    "./cat-limits": { MAX_IMAGES: 5 },
  },
  { process },
);
const ID = "gj34jfxk";

function setup({
  loggedIn = true,
  deleted = [{ id: 1 }],
  fail = false,
  images = [],
} = {}) {
  const conditions = [];
  const removed = [];
  const refreshed = [];
  const dialect = new PgDialect();
  const db = {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: async (condition) => {
            conditions.push(dialect.sqlToQuery(condition));
            return images;
          },
        }),
      }),
    }),
    delete: () => ({
      where: (condition) => {
        conditions.push(dialect.sqlToQuery(condition));
        return {
          returning: async () => {
            if (fail) throw new Error("Database unavailable");
            return deleted;
          },
        };
      },
    }),
  };
  const { deleteCatListing } = load(
    "app/(pages)/find_a_cat/[publicId]/delete-actions.ts",
    {
      "@/db": { db },
      "@/db/schema": schema,
      "@/lib/auth": {
        getSession: async () => (loggedIn ? { user: { id: "owner" } } : null),
      },
      "@/lib/cloudflareR2": {
        deleteCatPhotos: async (keys) => removed.push(...keys),
      },
      "@/lib/public-id": publicIdModule,
      "@/lib/uploads": uploadsModule,
      "next/cache": { revalidatePath: (url) => refreshed.push(url) },
    },
  );
  return { deleteCatListing, conditions, removed, refreshed };
}

test("anonymous callers cannot query or delete listings", async () => {
  const state = setup({ loggedIn: false });
  assert.equal((await state.deleteCatListing(ID)).ok, false);
  assert.equal(state.conditions.length, 0);
});

test("invalid listing IDs cannot reach the database", async () => {
  const state = setup();
  for (const id of [
    0,
    1,
    12345678,
    "",
    "1",
    "gj34jfx",
    "gj34jfxkk",
    "GJ34JFXK",
    "../../..",
    "gj34%fxk",
    null,
    undefined,
  ]) {
    assert.equal((await state.deleteCatListing(id)).ok, false);
  }
  assert.equal(state.conditions.length, 0);
});

test("both photo lookup and delete are constrained by public ID AND authenticated owner", async () => {
  const state = setup();
  assert.equal((await state.deleteCatListing(ID)).ok, true);
  assert.equal(state.conditions.length, 2);
  for (const condition of state.conditions) {
    assert.match(
      condition.sql.replace(/[()]/g, ""),
      /"cats"\."public_id" = \$1 and "cats"\."user_id" = \$2/,
    );
    assert.deepEqual(condition.params, [ID, "owner"]);
  }
});

test("missing, non-owned, or concurrently deleted listings do not delete photos", async () => {
  const state = setup({ deleted: [], images: [{ key: `cats/${ID}-1.webp` }] });
  assert.equal((await state.deleteCatListing(ID)).ok, false);
  assert.equal(state.removed.length, 0);
  assert.equal(state.refreshed.length, 0);
});

test("failed database mutation preserves uploaded photos", async () => {
  const state = setup({ fail: true, images: [{ key: `cats/${ID}-1.webp` }] });
  assert.equal((await state.deleteCatListing(ID)).ok, false);
  assert.equal(state.removed.length, 0);
});

test("successful deletion removes only this listing's R2 photos and refreshes affected pages", async () => {
  const state = setup({
    images: [
      { key: `cats/${ID}-1.webp` },
      { key: `cats/${ID}-2.webp` },
      { key: "cats/other123-1.webp" },
      { key: `cats/../${ID}-1.webp` },
      { key: `cats/${ID}-1.png` },
      { key: "owner/legacy.webp" },
      { key: "other/legacy.webp" },
    ],
  });
  assert.equal((await state.deleteCatListing(ID)).ok, true);
  assert.deepEqual(state.removed, [`cats/${ID}-1.webp`, `cats/${ID}-2.webp`]);
  assert.deepEqual(state.refreshed, ["/", "/find_a_cat", `/find_a_cat/${ID}`]);
});
```

**Example explained**

- **The imports** bring in Node's test tools (`test`, `assert`), `fs`, `vm`, `createRequire`, the TypeScript compiler (`ts`), and Drizzle's `PgDialect`, which can turn a Drizzle condition into SQL text for inspection.
- **`load(file, mocks, globals)`** reads a TypeScript file, **transpiles** it to CommonJS with the TypeScript compiler, then runs it with `vm.runInNewContext` in an isolated sandbox. The sandbox's `require` function returns a **mock** if the requested module is in `mocks`, and the real module otherwise. This is how a test can run a file that imports `@/db` without a real database. (Why not just import it? Because the file uses the `@/` alias and `"use server"`, which plain Node does not understand.)
- **The three `load(...)` constants** load the real schema, `public-id` and `uploads` modules. `uploads` gets a fake `./cat-limits` with `MAX_IMAGES: 5`.
- **`setup({ loggedIn, deleted, fail, images })`** builds the fake environment for one test: a fake `db` whose `select`/`delete` calls return the prepared data and **record the SQL conditions** they receive; a fake `getSession`; a fake `deleteCatPhotos` that **records the keys** it is asked to delete; and a fake `revalidatePath` that records URLs. It returns the real `deleteCatListing` plus those recordings.
- **The tests**, in order:
  1. _Anonymous callers_: no login → `ok: false` and **zero** database calls.
  2. _Invalid ids_: a long list of bad values (numbers, wrong lengths, uppercase, `../../..`, `null`) all fail without reaching the database.
  3. _Owner AND id_: both queries contain `"cats"."public_id" = $1 and "cats"."user_id" = $2` with the exact parameters `[ID, "owner"]`.
  4. _Nothing deleted_ (missing, not yours, or already gone): `ok: false`, no R2 deletes, no page refresh.
  5. _Database failure_: `ok: false`, no R2 deletes.
  6. _Success_: from a list containing the listing's own keys **and** a different listing's key, a `../` key, a `.png` key and unrelated prefixes, **only** `cats/<ID>-1.webp` and `cats/<ID>-2.webp` reach R2, and the three pages are refreshed.

> **What is not covered by automated tests:** `putCatPhoto`/`deleteCatPhotos` themselves (use `npm run r2:check`), `submitForm`, `compress-image.ts` (it needs a browser) and `purgeExpiredListings`. If you change those, test by hand: create a listing, check the bucket, delete it, check again.

## Chapter 17 quiz

1. Why do the negative tests include keys such as `cats/../gj34jfxk-1.webp`?
2. What does `vi.stubEnv` do, and why call `vi.unstubAllEnvs()` afterwards?
3. In `delete-listing.test.mjs`, how does the test confirm that other listings' photos are never deleted?
4. Which test would you run to verify your R2 credentials?

<details>
<summary>Show answers</summary>

1. They simulate a path-traversal attempt; the test proves the key checker rejects it.
2. It temporarily sets an environment variable for the test. Unstubbing prevents one test's setting from leaking into the next.
3. The fake `deleteCatPhotos` records the keys it receives, and the test asserts the recorded list contains only this listing's well-formed keys.
4. None of the automated ones; run `npm run r2:check`.

</details>

---

# Chapter 18: What can go wrong

## 18.1 Troubleshooting table

| Symptom                                                         | Likely cause                                                                | Where to look / fix                                                                                             |
| --------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| "Couldn't save the cat" on submit; server log shows an S3 error | Wrong endpoint, key, secret or bucket name; token not scoped to this bucket | Check the four `CLOUDFLARE_R2_*` variables. Run `npm run r2:check`. Restart `npm run dev` after editing `.env`. |
| Server log: `R2_PUBLIC_URL is not set`; pages crash             | `R2_PUBLIC_URL` missing                                                     | Set it (Chapter 4). `catPhotoUrl` throws deliberately.                                                          |
| Listing saved but photos show as broken images (403/404)        | Public access not enabled, wrong `R2_PUBLIC_URL`, or the object is missing  | `r2:check` step 2 tells you the status. Check Cloudflare → bucket → Settings → Public access.                   |
| `r2:check` fails at step 2 with a non-200 status                | `R2_PUBLIC_URL` is the S3 endpoint, or the public domain is not connected   | Use the r2.dev URL or custom domain, not `...r2.cloudflarestorage.com`.                                         |
| `r2:check` fails on `content-type` or `cache-control`           | Object stored without the metadata, or a CDN rule rewrites headers          | Check `putCatPhoto` (Chapter 7.2) and any Cloudflare rules on the domain.                                       |
| "One of the photos is too large."                               | A file over 1.25 MiB reached the server                                     | Normally impossible through the form (it compresses). Check `compressImage` and the limits.                     |
| "Upload failed. Please try again."                              | A file that is not WebP reached the server                                  | The client conversion was skipped or failed. Check the server log line "uploaded image is not WebP".            |
| Upload request rejected before reaching `submitForm`            | A host or proxy request-size cap (Vercel ~4.5 MB) or `bodySizeLimit`        | See Chapter 4.4: presigned uploads would be the fix.                                                            |
| A deleted listing's photo still loads                           | A CDN cached copy, or the R2 delete failed (look for `Couldn't remove`)     | Wait; check logs for `Couldn't remove some listing photos from R2`.                                             |
| Photos still in the bucket for listings that no longer exist    | Best-effort delete failed, or a crash happened mid-upload                   | Compare bucket keys with `cat_images.key` (an "orphan sweep" does not exist yet).                               |
| HEIC photo cannot be converted                                  | Rare codec variant, or the HEIC library failed to load                      | The browser console has the technical cause (`Compressing ... failed`).                                         |
| Photo appears sideways                                          | Orientation was not applied                                                 | See `decodeImage` (Chapter 9.3): `imageOrientation: "from-image"`.                                              |

## 18.2 Known limitations (by design or not yet addressed)

- **Orphaned objects are possible** (Chapter 12.11): a crash between steps, a slow in-flight upload after a failure, or a failed best-effort delete can leave objects in R2 that no database row points to. They are harmless but cost storage. There is no sweep script.
- **A tiny race in the purge:** photo keys are read before the cats are deleted. A listing that crosses the 3-month line _between_ those two queries is deleted with its photo rows, but its keys were never read, so its objects remain.
- **Listings with no photos can exist** after a crash between inserting the listing and inserting the photo rows.
- **No image decoding on the server:** the server trusts the header and size only (Chapter 12.5).
- **Expired photos stay reachable** at their URLs until the next purge (Chapter 15).
- **Full-size photos are used everywhere** (Chapter 13.4).
- **Photos cannot be edited** after upload. If editing is added, replaced photos need **new keys** (Chapter 3.1).
- **One-year immutable caching** means a key is effectively permanent in browsers and CDNs. Never reuse one.

---

# Chapter 19: Recipes: changing the system

Each recipe lists the files to touch. After any change, run `npm run test`, `npm run lint`, and do a manual create/view/delete cycle.

## Recipe 1: Change the maximum number of photos

1. Change `MAX_IMAGES` in `lib/cat-limits.ts`.
2. **If the new number is 10 or more, fix the key regex.** `[1-${MAX_IMAGES}]` breaks for two-digit numbers (Chapter 6.2). Replace line 7 of `lib/uploads.ts` with an alternation of the exact numbers:

   ```ts
   const PHOTO_NUMBERS = Array.from(
     { length: MAX_IMAGES },
     (_, i) => i + 1,
   ).join("|");
   const CAT_PHOTO_KEY = new RegExp(
     `^cats/[a-z0-9]{8}-(?:${PHOTO_NUMBERS})\\.webp$`,
   );
   ```

   `(?:1|2|3|...|12)` means "one of these exact numbers". For `-12.webp` the regex engine first tries `1`, sees that `\.webp` does not follow, **backtracks**, and eventually matches `12`. The `$` at the end guarantees nothing extra can follow.

3. Update `lib/uploads.test.ts`: it loops `n = 1..5` and rejects `-6`.
4. Check total request size: `MAX_IMAGES × 1.25 MiB` must fit well inside `bodySizeLimit` (20 MB), and your host's own limit.
5. Check `tests/delete-listing.test.mjs`: it hard-codes `MAX_IMAGES: 5` in its fake `./cat-limits`.

## Recipe 2: Change photo size or quality

- `MAX_DIMENSION` (longest side in pixels) and `TARGET_SIZE_BYTES` (what the browser aims for) in `lib/cat-limits.ts`.
- `MAX_STORED_SIZE_BYTES` (server limit) must stay **above** the target.
- `firstPassQuality` in `lib/compress-image.ts` controls the starting quality.
- Existing photos are unaffected. Only new uploads use the new settings.

## Recipe 3: Move to a custom domain

1. Cloudflare → bucket → Settings → Custom Domains → connect, for example, `img.example.com` (DNS zone must be on Cloudflare).
2. Set `R2_PUBLIC_URL=https://img.example.com`.
3. Run `npm run r2:check`.
4. Restart the app. **No database migration is needed**, because only keys are stored.

## Recipe 4: Store another kind of image (for example avatars)

1. Choose a **separate prefix** (`avatars/`), with its own key builder and its own strict pattern next to `catPhotoKey`/`isCatPhotoKey`, so deletes for one kind can never match the other.
2. Reuse `putCatPhoto`-style code (or generalise it) and keep `ContentType` and `CacheControl` consistent.
3. Keep the habits from this guide: validate on the server, claim the name before uploading, delete only well-formed keys, and never reuse a key.
4. Add tests like `lib/uploads.test.ts`.

## Recipe 5: Let users replace a photo

Give the new photo a **new key** (for example a version number: `cats/gj34jfxk-1-v2.webp`), update the `cat_images` row, then delete the old key. The key pattern and `isCatPhotoKey` must be extended to allow the version suffix.

## Recipe 6 (idea): Thumbnails

Cards display ~672 px wide images but load the 1600 px file. You could upload a second, smaller variant per photo and use it on cards. This needs: a second key pattern (or suffix), a second `PutObject` in `submitForm`, deleting both variants in the delete and purge flows, and a fix for the cleanup code so it knows about both. Nothing like this exists yet.

---

# Chapter 20: Glossary and cheat sheet

## Glossary

| Term                | Meaning                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| Access key / secret | The credentials for the S3 API. The secret must stay on the server.                                          |
| `after()`           | Next.js function that runs work after the response is sent.                                                  |
| Base64              | A way of writing binary data as text. Used for the test pixel in `check-r2.ts` and the old database storage. |
| `Blob` / `File`     | Browser objects holding bytes. A `File` is a `Blob` with a name.                                             |
| Bucket              | A named container of objects in R2/S3.                                                                       |
| `Buffer`            | Node.js's byte array.                                                                                        |
| Cache-Control       | HTTP header telling caches how long to keep a response.                                                      |
| Cascade             | A foreign key rule that deletes dependent rows automatically.                                                |
| CDN                 | A network of servers that keep copies of files near users.                                                   |
| Command (SDK)       | An object describing one S3 operation, sent with `client.send()`.                                            |
| Content-Type        | HTTP header naming the file's type (`image/webp`).                                                           |
| CORS                | Browser rules about JavaScript reading responses from other websites. Not needed for plain `<img>`.          |
| Egress              | Data leaving a storage service. R2 does not charge for it.                                                   |
| Endpoint            | The address of the S3 API. In Bilai, `CLOUDFLARE_R2_ENDPOINT`.                                               |
| `FormData`          | Browser object bundling form fields and files for one request.                                               |
| HEIC / HEIF         | The photo format iPhones use by default.                                                                     |
| Immutable           | A `Cache-Control` value promising the content at a URL never changes.                                        |
| Key                 | An object's unique name in a bucket (`cats/gj34jfxk-1.webp`).                                                |
| Magic bytes         | The first bytes of a file that identify its format.                                                          |
| Migration           | A SQL file that changes the database structure.                                                              |
| Object              | One stored item: bytes plus metadata.                                                                        |
| Object URL          | A temporary `blob:` address to preview a file in the browser.                                                |
| Orphan              | An R2 object that no database row points to.                                                                 |
| Prefix              | The beginning of a key (`cats/`). Not a real folder.                                                         |
| Presigned URL       | A temporary, signed link letting a browser upload/download directly. Not used by Bilai yet.                  |
| `public_id`         | The random 8-character id of a listing, used in URLs and photo keys.                                         |
| R2                  | Cloudflare's S3-compatible object storage.                                                                   |
| Region              | Where an S3 bucket lives. R2 uses `"auto"`.                                                                  |
| S3                  | Amazon's object storage, whose API R2 copies.                                                                |
| Server action       | A server function the browser can call (`"use server"`).                                                     |
| SigV4               | The request-signing scheme used by the S3 API.                                                               |
| Type guard          | A function like `value is string` that narrows a TypeScript type.                                            |
| WebP                | An efficient image format; the only one Bilai stores.                                                        |

## Cheat sheet

```text
KEY FORMAT      cats/<publicId>-<n>.webp     n = 1..MAX_IMAGES (position + 1)
PUBLIC ID       8 chars, a-z 0-9             random, unique in cats.public_id
PUBLIC URL      R2_PUBLIC_URL + "/" + key    built by catPhotoUrl(key)
CACHE HEADER    public, max-age=31536000, immutable      → never reuse a key
LIMITS          5 photos · pick ≤25 MB · long edge ≤1600 px · target 1 MiB · server max 1.25 MiB
UPLOAD ORDER    validate all → insert cats row → PutObject (parallel) → insert cat_images → redirect
DELETE ORDER    read keys → delete cats row (cascade) → DeleteObjects → revalidatePath
EXPIRY          3 months, hidden by isLiveListing at once, purged lazily (≤ every 10 min per server)
```

| I want to…                    | Open this file                                        |
| ----------------------------- | ----------------------------------------------------- |
| Change a size/count limit     | `lib/cat-limits.ts`                                   |
| Change how photos are shrunk  | `lib/compress-image.ts`                               |
| Change the picker UI          | `app/(pages)/add_a_cat/ImageGallery.tsx`              |
| Change upload validation/flow | `app/(pages)/add_a_cat/actions.ts`                    |
| Change key names or URLs      | `lib/uploads.ts`                                      |
| Change S3/R2 calls or headers | `lib/cloudflareR2.ts`                                 |
| Change how photos are read    | `lib/cats.ts`                                         |
| Change delete behaviour       | `app/(pages)/find_a_cat/[publicId]/delete-actions.ts` |
| Change expiry                 | `lib/listing-expiry.ts`                               |
| Check the bucket setup        | `npm run r2:check` (`scripts/check-r2.ts`)            |
| Raise the request-size limit  | `next.config.ts` (`serverActions.bodySizeLimit`)      |

| Command                                     | What it does                                |
| ------------------------------------------- | ------------------------------------------- |
| `npm run dev`                               | Start the app                               |
| `npm run r2:check`                          | Upload, read and delete a test object       |
| `npm run test`                              | Vitest, then `node --test tests/*.test.mjs` |
| `npx vitest run lib/uploads.test.ts`        | One vitest file                             |
| `node --test tests/delete-listing.test.mjs` | One node test file                          |
| `npm run lint` / `npm run format:check`     | ESLint / Prettier check                     |

## Where to read more

You said you already know the basics from the official docs. These are good next stops, because they explain things this app uses without showing in the code:

- Amazon S3 documentation: <https://docs.aws.amazon.com/s3/>
- Cloudflare R2 documentation: <https://developers.cloudflare.com/r2/>
- In the R2 docs, look for the pages on **S3 API compatibility** (which S3 operations R2 supports), **Public buckets** (r2.dev vs custom domains) and **Presigned URLs** (the upgrade path if request-size limits ever block uploads).
- AWS SDK for JavaScript v3 reference: <https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/>
- The Next.js docs shipped with this project: `node_modules/next/dist/docs/` (this repo's Next.js is a newer version than most tutorials; check these first).

Also in this folder: [`README.md`](README.md), the shorter reference for ids, keys, setup and history.

[All project docs](../README.md)

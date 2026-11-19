# Bilai photo storage tutorial

[Guide home](README.md) · [Source reference](source_reference.md) · [Quiz](quiz.md)

1. [Read an image as bytes](#1-read-an-image-as-bytes)
2. [Pick, compress and reorder photos](#2-pick-compress-and-reorder-photos)
3. [Send the photos to the server](#3-send-the-photos-to-the-server)
4. [Store files and metadata in PostgreSQL](#4-store-files-and-metadata-in-postgresql)
5. [Show a photo in the browser](#5-show-a-photo-in-the-browser)
6. [Delete, expire and recover photos](#6-delete-expire-and-recover-photos)
7. [Make a change and verify it](#7-make-a-change-and-verify-it)

## 1. Read an image as bytes

A **pixel** is one point in an image. A 4000 × 3000 image has 12 million pixels. A **byte** holds eight bits. If every pixel is unpacked into four 8-bit channels (red, green, blue and alpha), the pixels alone take about 48 MB in memory. The original JPEG could take only 3 MB on disk. Width and height describe the decoded image. File size describes the encoded bytes. Bilai limits both quantities at different stages.

| Value         | What it represents                                               | Where Bilai uses it                        |
| ------------- | ---------------------------------------------------------------- | ------------------------------------------ |
| `File`        | A binary blob with a name and other file metadata                | Selected photo and compressed upload       |
| `ImageBitmap` | Pixels decoded by the browser and available to draw              | Input to the canvas                        |
| `Blob`        | Raw bytes with a size and optional media type                    | Canvas output                              |
| `ArrayBuffer` | A block of bytes read from the file                              | Output of `await file.arrayBuffer()`       |
| `Buffer`      | A Node.js byte array with methods for reading and encoding bytes | WebP check, base64 conversion and disk I/O |
| Base64 string | Text that represents the same compressed bytes                   | PostgreSQL `cat_images.data`               |
| `Uint8Array`  | A typed view whose elements are unsigned bytes                   | Body sent by the photo route               |

**WebP** is the image format. It describes how the file represents pixels and optional data like transparency. A WebP file has a RIFF container header. Bytes at offsets 0–3 spell `RIFF`; bytes at 8–11 spell `WEBP`. Bilai's `isWebp()` checks those markers and requires more than 12 bytes. This signature check identifies the expected container header. It leaves decoding, dimension checks, and full file validation outside the server action. The browser's `file.type` and the `.webp` suffix are separate pieces of metadata. [WebP format specification](https://www.rfc-editor.org/rfc/rfc9649.html#section-2) · [Upload helpers](source_reference.md#upload-helpers)

**Base64** changes the representation of bytes so they fit in a text column. Every group of three bytes becomes four characters, with padding for a final partial group. The length is `4 * Math.ceil(bytes / 3)`. A 1 MiB photo becomes 1,398,104 characters before database or HTTP overhead. The conversion is reversible and adds about one third to the payload. WebP encoding is the stage that compresses the image. [Base64 specification](https://www.rfc-editor.org/rfc/rfc4648.html#section-4)

### Try it yourself

Run this in a Node console. The four sample bytes are just the letters from the opening marker of a RIFF header.

```js
const bytes = Buffer.from([82, 73, 70, 70]);
const text = bytes.toString("base64");

console.log(text); // UklGRg==
console.log(Buffer.from(text, "base64").equals(bytes)); // true
```

Change one number. Predict what happens to the printed string and equality check. The equality stays true because the comparison uses the changed input and its own round trip.

## 2. Pick, compress and reorder photos

The upload page mounts `ListACat`, which owns the ordered `GalleryImage[]`. Each gallery item stores a temporary UI ID, a compressed `File`, a local preview URL, and a caption. The gallery receives these items and sends a new array back through `onChange`. Its generic `moveItem<T>` copies the outer array, removes one item with `splice`, and inserts it at the destination. Each caption travels with its item. [Upload page](source_reference.md#upload-page) · [Photo picker and previews](source_reference.md#photo-picker-and-previews)

| Source lines | What to look for                                                                                                                                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 18–61        | The item type, reorder helper, input ref, drag state, and cleanup effect. The ref gives the cleanup the latest rendered list.                                                                                               |
| 63–112       | Picker and drag-and-drop share `addFiles()`. It checks the reported MIME type, original file size, and free slots. An awaited loop encodes one file at a time and lets the batch keep successful photos when an item fails. |
| 114–140      | Removal revokes the item's URL. Caption changes use `map`. Dragging finds the current indexes by item ID.                                                                                                                   |
| 142–220      | File input, drop handlers, progress status, and error list. Resetting the input allows the same file to trigger another change event.                                                                                       |
| 222–319      | Sortable items, keyboard arrow handlers, previews, cover label, captions, and remove buttons. Index `0` gets the cover label.                                                                                               |

The browser accepts JPEG, PNG, GIF, and WebP with reported sizes up to **25 MiB** each. The gallery holds up to **five** photos. `File.type` is the browser's media type label, so a file can pass that check and still fail when decoded. A very large decoded image can also use much more memory than its input byte count suggests. [Shared limits](source_reference.md#shared-photo-limits)

### How compression works

1. **Decode** with `createImageBitmap(file, { imageOrientation: "from-image" })`. This applies the source orientation while decoding. Canvas draws fresh pixels, so the original EXIF metadata is left behind. Animated inputs become a single frame because the bitmap holds the default image or first frame. [Bitmap specification](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#dom-createimagebitmap)
2. **Resize** with `Math.min(1, 1600 / longestEdge)`. Multiply both dimensions by that factor and round. A 4000 × 3000 photo becomes 1600 × 1200 before encoding, while a 900 × 600 photo keeps its dimensions on the first pass.
3. **Encode** to `image/webp` with `canvas.toBlob`. The helper wraps the callback in a `Promise<Blob | null>`. Original file size selects quality `0.82`, `0.72`, `0.62`, or `0.52` at up to 2×, 5×, 10×, or more than 10× the 1 MiB target. Quality is an encoder setting. Measure `blob.size` to learn the output size. The first pass checks for PNG fallback because the browser can return PNG if it cannot encode the requested format. [Canvas encoding specification](https://html.spec.whatwg.org/multipage/canvas.html#serialising-bitmaps-to-a-file)
4. **Try once more if needed.** When the first blob exceeds 1 MiB, the code scales each dimension by `sqrt(0.9 * target / blob.size)`, keeps the same quality and draws from the original bitmap again. The square root makes the area shrink by the intended ratio. If the first result is twice the target, the linear scale is about 0.671, leaving about 45% of the first pass's pixel area. Encoded size only roughly follows area, so the next size check can still fail.
5. **Return and clean up.** `new File([blob], name, { type: "image/webp" })` gives the new bytes a filename for upload. `ImageUploadError` carries the message the gallery can display. The `finally` block closes the bitmap on success or failure. `URL.createObjectURL(compressed)` then gives the gallery a local `blob:` URL. Revoking that URL releases the browser's reference through the URL. The gallery holds its own reference to the `File` until removal or unmount.

Read `compress-image.ts` in three passes. Lines 1–34 set up the quality and canvas helpers, 42–61 decode and encode, and 63–91 handle overshoot, return, errors and cleanup. [WebP encoder](source_reference.md#webp-encoder)

### Try it yourself

Pause after `compressImage(file)` in `ImageGallery.tsx`. Compare `file.name`, `file.size`, `compressed.name`, and `compressed.size` in the debugger. Add a second photo and use the reorder handle or its arrow keys. Check which item gets the cover label. Your previews are already visible at this stage because they use browser-local URLs.

## 3. Send the photos to the server

The form stores the gallery in React state. `handleSubmit()` stops the default form submission, validates the inputs, and calls the Server Action inside a transition. The transition supplies the pending state used by the submit button. It adds one `images` entry and one `captions` entry for every gallery item. `append()` preserves multiple values for each key. The server uses `getAll()` to read them in sequence. Using `set()` in that loop would keep only the last value for each key. [Listing form, especially lines 84–173 and 310–328](source_reference.md#listing-form)

```js
const packet = new FormData();
packet.append("captions", "Window");
packet.append("captions", "Basket");

console.log(packet.getAll("captions")); // ["Window", "Basket"]
```

| Limit                       | Enforced by               | Value                             |
| --------------------------- | ------------------------- | --------------------------------- |
| Selected original file      | Gallery                   | 25 MiB each                       |
| Long edge after resizing    | Browser encoder           | 1600 px first pass                |
| Compressed output target    | Browser encoder           | 1 MiB each                        |
| Submitted photo bytes       | Server Action             | 1.25 MiB each                     |
| Number of photos            | Gallery and Server Action | Server requires 1–5               |
| Whole Server Action request | Next.js `bodySizeLimit`   | `"20mb"`, including form overhead |

The action starts by reading the session from the current request and validating the listing fields. Lines 99–114 use the type predicate `(v): v is File => v instanceof File` to narrow entries to `File[]`. Captions are converted to strings. The action checks the count of each array because position pairs captions with photos. Lines 116–131 read and validate every photo before listing writes. The action enforces size and WebP markers. The 1600 px dimension limit comes from the browser path. The comment about validation before a disk write dates to an older storage implementation. [Listing Server Action](source_reference.md#listing-server-action) · [Session lookup](source_reference.md#session-lookup) · [Request body limit](source_reference.md#request-body-limit)

### Try it yourself

Predict what would happen if the form appended five files and four captions. Find the exact return value in the action. Then find how `ListACat` turns the returned `{ ok: false, error }` into a message. Compare that path with the form's `catch` for a rejected action call.

## 4. Store files and metadata in PostgreSQL

Drizzle maps the TypeScript property name `catId` to the SQL column `cat_id`. The app connects via Drizzle's Neon HTTP driver using `DATABASE_URL`. One row in `cats` owns many rows in `cat_images`. The `cat_id` foreign key requires an existing cat. Its cascade rule takes photo rows with the cat when the database deletes it. The index on `cat_id` helps queries find a listing's photos. Postgres generates `cat_images.id` as a UUID for the row. The separate UUID in `key` identifies its storage path. [Database connection](source_reference.md#database-connection) · [Listing and photo schema](source_reference.md#listing-and-photo-schema)

| Column     | Example                            | Purpose                                                 |
| ---------- | ---------------------------------- | ------------------------------------------------------- |
| `id`       | Database-generated UUID            | Identifies the row and breaks ties in photo order       |
| `cat_id`   | `123`                              | Links the photo to its listing                          |
| `key`      | `user123/photo-uuid.webp`          | Lookup key and relative path for local copies           |
| `url`      | `/uploads/user123/photo-uuid.webp` | Address used by the browser                             |
| `caption`  | `"By the window"` or `NULL`        | Optional text, trimmed to 200 JS string units           |
| `position` | `0`, `1`, …                        | Gallery order, with `0` as the normal cover             |
| `data`     | Base64 text or `NULL`              | Compressed bytes in text form, nullable for legacy rows |

`submitForm` builds rows with the authenticated user ID, a generated filename, and `buf.toString("base64")`. The original filename stays out of the storage key. It inserts the cat first and uses `.returning({ id: cats.id })` to get the generated ID. It then adds that ID to each photo row and inserts the batch. The two statements are separate. If the photo insert throws after the cat insert succeeded, the catch block attempts to delete the cat. That is compensating cleanup. A process interruption or a failing cleanup query can still leave a listing without its photos. Saving a missing profile phone also happens before these statements and is separate from that cleanup. On success, `after(purgeExpiredListings)` schedules expiry maintenance and `redirect("/")` runs outside the catch because Next.js implements it by throwing. [Listing Server Action, lines 133–197](source_reference.md#listing-server-action)

The shared-storage migration adds nullable `data text` to the existing table. It leaves old rows' keys and URLs in place. A legacy photo with a local copy can still use its original URL, and the sync script can fill in its missing data later. [Photo data migration](source_reference.md#photo-data-migration)

### Try it yourself

Run this read-only query against your development database. Replace `123` with your sample listing ID. A non-null byte string becomes a positive `base64_chars` count. A legacy null also yields null from `length()`.

```sql
SELECT id, cat_id, position, caption, key, url, length(data) AS base64_chars
FROM cat_images
WHERE cat_id = 123
ORDER BY position, id;
```

Compare `base64_chars` with the size of the corresponding HTTP response. The database holds the encoding, while the response carries the decoded WebP bytes.

## 5. Show a photo in the browser

Bilai's data reads have two jobs. The listing queries fetch photo URLs and captions for the HTML. The photo route looks up the bytes for each requested image. Keeping those queries separate lets the card queries select one small URL per listing.

- **Cover photos.** `getFeaturedCats()`, `getCats()`, and `getUserCats()` use a subquery referring to the outer cat's ID. They sort by `position` and then `id`, and return the first URL. Their consumers pass that result into `CatCard`, which shows a placeholder if the URL is null. [Queries, lines 25–45, 96–129 and 173–195](source_reference.md#listing-and-photo-queries) · [Cover card](source_reference.md#cover-card)
- **Listing galleries.** `getCat()` checks for a live listing, selects the image metadata in the same order, and derives the cover from `images[0]?.url ?? null`. React's `cache()` lets metadata and the page share a read within a request. The page renders the first photo in a wider figure and uses the caption as alt text when present. [Queries, lines 140–171](source_reference.md#listing-and-photo-queries) · [Listing detail page, lines 49–96](source_reference.md#listing-detail-page)
- **Image requests.** Both views use `<Image unoptimized>`. The browser requests the saved URL directly. The photo handler controls which bytes come back. [Photo GET handler](source_reference.md#photo-get-handler)

### Follow one GET request

For `/uploads/user123/photo-uuid.webp`, the catch-all Next.js route gets a path array with two segments. It awaits the route params, resolves the filesystem path under `UPLOAD_ROOT`, and requires a path inside that directory ending in `.webp`. The `path.sep` in the prefix check sets a directory boundary. It then joins the original segments with `/` to make the database key.

The query joins `cat_images` to `cats` on the photo's foreign key and checks both the key and `isLiveListing`. Anyone can request a known URL for a live listing. Expiry is about the listing's age, so adoption status is a separate rule. If the live row exists, the handler decodes non-empty base64 from Postgres or reads the local file when the row has no stored data.

| Situation                                  | What the handler returns            |
| ------------------------------------------ | ----------------------------------- |
| Live row with data                         | `200` and the decoded WebP bytes    |
| Live row with no data, local file present  | `200` and the local WebP bytes      |
| Invalid path, no live row, or missing file | `404 Not found`                     |
| Other error inside the lookup or read      | `503 Photo temporarily unavailable` |

Success sends `Content-Type: image/webp` and `Cache-Control: public, max-age=604800, immutable`. The latter permits a cached copy to remain fresh for **seven days**. The listing lifetime in `listing-expiry.ts` is **three months**. A fresh request checks expiry immediately, while a previously cached response can still be reused after deletion or expiry. Page revalidation and image HTTP caching have different lifecycles. [GET handler](source_reference.md#photo-get-handler) · [Listing expiry](source_reference.md#listing-expiry)

### Try it yourself

Open the sample listing and copy its photo request path from the Network panel. In the console on the same site, replace the sample path below and run the code. Check the status, media type and byte count against the request panel. The `no-store` option bypasses your browser's HTTP cache for the check.

```js
const response = await fetch("/uploads/user123/photo-uuid.webp", {
  cache: "no-store",
});

console.log(response.status, response.headers.get("content-type"));
console.log((await response.arrayBuffer()).byteLength);
```

## 6. Delete, expire and recover photos

### Remove a listing

Both **Mark adopted** and **Remove listing** currently call the same delete action after confirmation. The server reads the session, validates the numeric listing ID, and puts ownership in the conditions for both the photo-key query and the cat deletion. `.returning()` tells the action whether it actually deleted a row. This matters if another request already deleted it between those two calls. The database cascades the child rows. Only after a successful deletion does the action attempt to unlink local files under the authenticated owner's upload directory. A missing file is treated as already gone. The action then revalidates the home, browse, and detail paths. [Deletion controls](source_reference.md#owner-deletion-controls) · [Deletion action](source_reference.md#owner-deletion-action) · [Deletion tests](source_reference.md#deletion-tests)

### Expire a listing

`now() - make_interval(months => 3)` gives Postgres the cutoff. A listing is live when `created_at` is greater than the cutoff. A listing exactly on the cutoff is already expired. The reads use that rule before physical cleanup happens. Listing creation, Find a Cat and the signed-in Profile schedule `purgeExpiredListings` via `after()`. The purge is throttled to once per ten minutes on each running server instance.

The purge queries the expired listings' photo keys, deletes expired cat rows, then calls `removeLocalPhotos()` for the collected keys. The foreign key cascade handles the database data. The local cleanup accepts WebP paths inside the upload root. Each server only has access to its own local directory. In the event of a purge error, resetting `lastPurgeAt` lets a later request try again. [Expiry code](source_reference.md#listing-expiry) · [Upload helpers](source_reference.md#upload-helpers) · [Browse call site](source_reference.md#find-a-cat-call-sites) · [Profile call site](source_reference.md#profile-call-sites)

### Sync legacy files

`npm run photos:sync` runs `scripts/sync-photos.ts` from the repo root. It uses `dotenv/config` and the process's `DATABASE_URL`. Dotenv loads `.env` by default, so a value configured only in Next.js's `.env.local` needs to be passed to the script's environment separately. The script enumerates the database's photo rows and resolves each row's key inside `uploads/`.

| Database field and local file                | What sync does                                                                                       |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Non-empty `data`, with or without local file | Decodes, checks the WebP header, creates folders, and writes the file, overwriting an existing copy. |
| SQL `NULL` and local WebP exists             | Reads the file, checks the header, and imports while `data IS NULL`.                                 |
| SQL `NULL` and no local file                 | Counts the photo as missing and continues.                                                           |
| File exists locally with no database row     | Leaves the file alone because the loop starts from database rows.                                    |

The runtime route also starts from a live database row. Finding a WebP on disk is therefore only useful for serving if the row still exists. The sync script reads all photo rows, including any expired rows waiting to be purged. Its guarded import avoids overwriting a value added by another run. The `imported` counter records attempts after successful query calls, so a concurrent import can increment the counter even when the guarded update changes zero rows. Both the DB and working tree can change when you run sync. Local exports are separate from Git commits. [Sync script](source_reference.md#legacy-photo-sync) · [Package command](source_reference.md#package-commands)

### Try it yourself

Delete your sample listing through the UI and repeat the `fetch` experiment. Expect `404` on a fresh request. Run the read-only SQL query again and check that it returns zero photo rows. To reason about legacy recovery without changing database data, pick each row from the sync table and trace which branch in the script runs.

## 7. Make a change and verify it

### Example change

Say you want the maximum photo count to become **six**. Start with `MAX_IMAGES`. It drives the gallery count, available slots, and server-side count validation. Then calculate the request size budget using the new count and review `bodySizeLimit`. Include multipart overhead and any limit imposed by your deployment. If you change the stored data format instead, trace the writer, route, schema or migration, and sync script together. Legacy rows still depend on their keys and URLs.

| Symptom                        | First thing to check                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| Picker rejects a file          | Original size, browser MIME label, and free slots                                              |
| Preview fails                  | Decode errors, WebP support, and the canvas output size                                        |
| Preview works but save fails   | Server Action request limit, session, file/caption pairing, then the listing and photo inserts |
| Caption or cover looks wrong   | Gallery order, paired `FormData` entries, and saved `position`                                 |
| Card shows a placeholder       | Whether the cover query returned a URL                                                         |
| Photo URL returns `404`        | Key, live listing filter, and whether a legacy file still exists                               |
| Photo URL returns `503`        | Server log for the database or file read error                                                 |
| Recently deleted photo appears | Compare a fresh request with the previously cached response                                    |

### Try it yourself

In a scratch branch and development database, change just the count limit. Try the new maximum and one beyond it. Save a test listing, verify the order and captions, and delete it. Run `npm run test`. The existing deletion tests cover login, ownership, invalid IDs, failure ordering, local cleanup and confirmation. Use the manual exercise to check the picker, encoding, save and delivery. When you are done, take the quiz without looking at the code on your first pass.

[Take the quiz](quiz.md) · [Read the full source reference](source_reference.md)

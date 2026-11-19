# Listing photo storage quiz

[Guide home](README.md) · [Tutorial](tutorial.md) · [Source reference](source_reference.md)

Pick one answer for each question in Part 1. Write out your reasoning for Part 2, then open the answer key.

## Part 1. Multiple choice

1. A 3 MiB JPEG decodes to 4000 × 3000 pixels. What does the 3 MiB measure?
   - A. Encoded bytes in the selected file
   - B. Memory required for the decoded pixels
   - C. The size of the eventual Postgres value
2. Which step makes the encoded file smaller in the normal upload flow?
   - A. `Buffer.from(await file.arrayBuffer())`
   - B. Canvas resizing and WebP encoding
   - C. `buf.toString("base64")`
3. What does a positive result from `isWebp()` tell you?
   - A. The file is decodable and within the 1600 px limit.
   - B. The browser declared `image/webp`.
   - C. The buffer is longer than 12 bytes and matches the two header markers.
4. The first compression pass outputs 2 MiB. Roughly what percentage of the first pass's **width** does the second pass use?
   - A. 45%
   - B. 67%
   - C. 90%
5. You add A and B with captions, then move B to the top. What gets saved at `position: 0`?
   - A. B with its own caption
   - B. B with A's caption
   - C. A with its original caption
6. A live photo row has SQL `NULL` in `data`. Which check determines whether a request can still succeed?
   - A. Whether the file picker cached the input
   - B. Whether the key resolves to an available local WebP file
   - C. Whether `position` equals `0`
7. A visitor has an image cached from yesterday and the owner just deleted the listing. What may happen?
   - A. A cached copy can still appear, and a fresh request can return `404`.
   - B. `revalidatePath()` immediately clears that photo from every visitor's browser.
   - C. The app serves fresh requests until the seven-day cache window ends.
8. When does the delete action attempt to unlink the owner's local copies?
   - A. Before checking ownership
   - B. After the key lookup, even if the DB delete fails
   - C. After the owner-constrained database delete returns a deleted row

## Part 2. Read the code and predict

9. Draw the upload path starting from a JPEG. Place `ImageBitmap`, WebP `Blob`, `FormData`, Node `Buffer`, and base64 in order. Then trace the path from the saved URL back to the browser.
10. Five photo files arrive with four captions. What does the action return? Has the action inserted anything yet? Where does the user see the message?
11. The database accepts the cat insert, then the photo insert throws. What cleanup does the action attempt? How can a cat row survive that failure?
12. Two photos have the same `position`. How do the cover subquery and the gallery keep a consistent order?
13. A listing reached its exact three-month cutoff, but purge has yet to run. Predict what a fresh photo request returns and whether a photo row can still be in the DB.
14. Predict the sync results for three rows. A has base64 data and no local file. B has SQL `NULL` and a valid local WebP. C has SQL `NULL` and no local file. Which counter could be misleading during concurrent imports?
15. The preview works, but every photo on the saved detail page fails. Name the two HTTP statuses you would distinguish first and the next evidence you would inspect for each.
16. You increase the browser's target to 1.5 MiB, leaving all other limits intact. A file comes out at about 1.4 MiB. Walk through its preview and save outcomes. Which limits would you review before shipping that change?
17. A teammate wants to replace the bytes at the same photo URL. Explain how the current cache header could affect visitors and why a new storage key would change the result.

## Answer key

<details>
<summary>Show answers and explanations</summary>

1. **A.** File size measures the encoded bytes. The decoded pixel dimensions and memory use are separate.
2. **B.** The canvas draws fewer pixels when it resizes and the encoder produces compressed WebP bytes. Base64 expands the representation by about one third.
3. **C.** It checks byte length and the `RIFF` and `WEBP` markers. The server action uses no image decoder.
4. **B.** The width factor is `sqrt(0.9 / 2)`, about 0.671. The area factor is about 0.45.
5. **A.** The gallery moves the whole item. The form appends B and its caption first and the action assigns index zero.
6. **B.** A live row with no stored data uses the legacy disk fallback. A missing file produces `404`.
7. **A.** The existing image response has a seven-day freshness period. The server checks for a live database row on a fresh request.
8. **C.** Successful DB deletion cascades photo rows before the action attempts local cleanup.
9. JPEG `File` → decoded `ImageBitmap` → WebP `Blob` → new WebP `File` → `FormData` → `ArrayBuffer` → Node `Buffer` → base64 text. On read, the page passes the saved URL to the image element. Its GET asks the route for the live row. The route decodes the base64 to bytes and returns a `Uint8Array` body that the browser decodes as an image.
10. The action returns `{ ok: false, error: "Something went wrong. Please try again." }`. It has done no inserts. The form's transition reads `result.error`, updates error state, and the form renders the message.
11. It tries to delete the cat by its returned ID. This is a separate DB statement. A failed cleanup query or a process interruption before that cleanup can leave the cat row behind.
12. Both sorts use ascending `position` followed by ascending `id`. The second column makes the tie deterministic. The cover takes the first entry from that order.
13. A fresh request returns `404`. A photo row can still exist because the live filter applies before the separate purge deletes expired rows.
14. A is exported, B is imported and C is counted as missing. The `imported` count can increase after a guarded update matches zero rows because another process already filled in the data.
15. For `404`, compare the URL and key, check whether the linked listing passes the live filter, then check legacy disk availability if needed. For `503`, read the server log to see whether the database query or the file read failed.
16. The browser accepts the 1.4 MiB output under the changed 1.5 MiB target and creates a preview. The server rejects its bytes above the unchanged 1.25 MiB ceiling. Review target, server byte cap, photo count and total request budget together.
17. A client can reuse its cached response at the old URL during its freshness period. A new key produces a new URL, so the browser requests the new photo independently of the older cache entry.

</details>

[Review the tutorial](tutorial.md)

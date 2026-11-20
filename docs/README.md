# Bilai documentation

## Image storage

- [Listing photo storage](image_storage/README.md) covers how photos are stored in Cloudflare R2: listing ids and photo keys, the code path from upload to cleanup, bucket setup, environment variables, and the `r2:check` smoke test.
- [Image storage guide](image_storage/guide.md) is a step-by-step learning guide (W3Schools style): Amazon S3 and Cloudflare R2 concepts, every line of the image-handling code explained, and a quiz after each chapter.

## Chat

- [Chat code walkthrough](chat/chat_code_walkthrough.md) traces the merged implementation.
- [Ably setup](chat/ably_setup.md) covers configuration and the webhook.
- [Chat feature plan](chat/chat_button_plan.md) records the original design and phases.
- [Chat implementation report](chat/chat_implementation_report.md) records the pre-merge build and checks.

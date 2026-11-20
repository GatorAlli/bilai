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

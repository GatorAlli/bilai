-- Every user can have a Bangladesh mobile number, stored as 8801712345678
-- (see lib/phone.ts). It is unique, so one number means one account.
-- Nullable: people who existed before this, and Google sign-ups, have none
-- until they add one when listing a cat.
ALTER TABLE "public"."user" ADD COLUMN IF NOT EXISTS "phone" text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_phone_key') THEN
    ALTER TABLE "public"."user" ADD CONSTRAINT "user_phone_key" UNIQUE ("phone");
  END IF;
END $$;

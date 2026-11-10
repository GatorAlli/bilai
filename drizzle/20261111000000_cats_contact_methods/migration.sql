-- Listers choose how adopters can reach them: WhatsApp, a phone call, or both.
-- Existing cats get both so they stay contactable.
ALTER TABLE "public"."cats" ADD COLUMN "contact_whatsapp" boolean DEFAULT false NOT NULL;
ALTER TABLE "public"."cats" ADD COLUMN "contact_call" boolean DEFAULT false NOT NULL;
UPDATE "public"."cats" SET "contact_whatsapp" = true, "contact_call" = true;
ALTER TABLE "public"."cats" ADD CONSTRAINT "cats_contact_method_check" CHECK ("contact_whatsapp" OR "contact_call");

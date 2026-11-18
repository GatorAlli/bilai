-- Who opened each conversation, so new threads can be rate-limited per user
-- (MAX_NEW_THREADS_PER_HOUR in lib/chat-limits.ts) without counting threads
-- other people opened with them.
ALTER TABLE "chat_threads" ADD COLUMN IF NOT EXISTS "started_by" text;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_threads_started_by_user_id_fkey') THEN
    ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_started_by_user_id_fkey" FOREIGN KEY ("started_by") REFERENCES "user"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_threads_started_by_created_idx" ON "chat_threads" ("started_by","created_at");

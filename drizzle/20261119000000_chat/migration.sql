-- Chat (see docs/chat_button_plan.md). Messages are delivered by Ably Chat and
-- copied here by the Ably webhook.
--
-- chat_threads: one row per pair of users, shared across all of one owner's
-- cats. user_a < user_b (byte order, matching JavaScript's `<`) so a pair has
-- one row whoever starts the chat. No foreign key to cats: a conversation
-- outlives the listing that started it.
CREATE TABLE IF NOT EXISTS "chat_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"room_name" text NOT NULL UNIQUE,
	"user_a" text NOT NULL,
	"user_b" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone,
	CONSTRAINT "chat_threads_pair_key" UNIQUE("user_a","user_b"),
	CONSTRAINT "chat_threads_ordered_check" CHECK ("user_a" COLLATE "C" < "user_b" COLLATE "C"),
	CONSTRAINT "chat_threads_user_a_user_id_fkey" FOREIGN KEY ("user_a") REFERENCES "user"("id") ON DELETE CASCADE,
	CONSTRAINT "chat_threads_user_b_user_id_fkey" FOREIGN KEY ("user_b") REFERENCES "user"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_threads_user_b_idx" ON "chat_threads" ("user_b");
--> statement-breakpoint

-- chat_messages: keyed by Ably's message serial, so a redelivered webhook is
-- harmless. version_serial is the latest Ably version applied; version serials
-- sort as strings, so an older update or delete arriving late can be ignored.
CREATE TABLE IF NOT EXISTS "chat_messages" (
	"serial" text PRIMARY KEY,
	"thread_id" uuid NOT NULL,
	"sender_id" text NOT NULL,
	"text" text NOT NULL,
	"version_serial" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chat_messages_thread_id_chat_threads_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "chat_threads"("id") ON DELETE CASCADE,
	CONSTRAINT "chat_messages_sender_id_user_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "user"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_thread_created_idx" ON "chat_messages" ("thread_id","created_at");
--> statement-breakpoint

-- chat_reads: when each user last read each thread; drives the unread badge.
CREATE TABLE IF NOT EXISTS "chat_reads" (
	"thread_id" uuid,
	"user_id" text,
	"last_read_at" timestamp with time zone NOT NULL,
	CONSTRAINT "chat_reads_pkey" PRIMARY KEY("thread_id","user_id"),
	CONSTRAINT "chat_reads_thread_id_chat_threads_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "chat_threads"("id") ON DELETE CASCADE,
	CONSTRAINT "chat_reads_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);

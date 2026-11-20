"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { chatThreads } from "@/db/schema";
import { getSession } from "@/lib/auth";
import {
  countThreadsStartedSince,
  getCatOwnerForChat,
  type ChatUser,
} from "@/lib/chat";
import { MAX_NEW_THREADS_PER_HOUR } from "@/lib/chat-limits";
import { pairFor } from "@/lib/chat-rooms";

export type OpenThreadResult =
  | { ok: true; roomName: string; other: ChatUser }
  | { ok: false; error: string };

// Opens (or reuses) the conversation between the signed-in user and a cat's
// parent. This is the only way a chat_threads row is created, so a thread can
// only start from a live listing you don't own: there is no "message any user
// id" endpoint. The room joins the user's Ably token capability on the next
// token request (the dock calls auth.authorize() for that).
export async function openThread(publicId: string): Promise<OpenThreadResult> {
  // Server actions can be called directly, so check everything here.
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "Please log in to chat." };

  const owner = await getCatOwnerForChat(publicId);
  if (!owner) {
    return { ok: false, error: "This cat is no longer available." };
  }
  if (owner.id === session.user.id) {
    return { ok: false, error: "This is your own listing." };
  }

  const { userA, userB, roomName } = pairFor(session.user.id, owner.id);
  const created = await db
    .insert(chatThreads)
    .values({ userA, userB, roomName, startedBy: session.user.id })
    .onConflictDoNothing()
    .returning({ id: chatThreads.id });

  // Only brand-new threads count towards the limit. Checked after the insert
  // so reopening an existing chat is never blocked; an over-limit new thread
  // is removed again.
  if (created.length > 0) {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const started = await countThreadsStartedSince(session.user.id, hourAgo);
    if (started > MAX_NEW_THREADS_PER_HOUR) {
      await db.delete(chatThreads).where(eq(chatThreads.id, created[0].id));
      return {
        ok: false,
        error:
          "You've started a lot of new chats in the last hour. Please try again later.",
      };
    }
  }

  return { ok: true, roomName, other: owner };
}

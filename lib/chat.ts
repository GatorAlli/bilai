import "server-only";

import {
  and,
  count,
  desc,
  eq,
  gt,
  gte,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import { cats, chatMessages, chatReads, chatThreads, user } from "@/db/schema";
import { isLiveListing } from "@/lib/listing-expiry";

// The only place that reads chat_threads / chat_messages / chat_reads (same
// rule as lib/cats.ts and lib/contact.ts). Room-name helpers that the browser
// also needs live in lib/chat-rooms.ts.

export type ChatUser = { id: string; name: string; image: string | null };

export type ThreadSummary = {
  roomName: string;
  other: ChatUser;
  lastMessageAt: string | null;
  unread: number;
};

const isMember = (userId: string) =>
  or(eq(chatThreads.userA, userId), eq(chatThreads.userB, userId));

// Messages from the other person, not deleted, newer than my last read.
const unreadFor = (userId: string) =>
  and(
    ne(chatMessages.senderId, userId),
    isNull(chatMessages.deletedAt),
    or(
      isNull(chatReads.lastReadAt),
      gt(chatMessages.createdAt, chatReads.lastReadAt),
    ),
  );

const readsJoin = (userId: string) =>
  and(eq(chatReads.threadId, chatThreads.id), eq(chatReads.userId, userId));

// Room names the user may join; becomes their Ably token capability.
export async function getThreadRoomNames(userId: string) {
  const rows = await db
    .select({ roomName: chatThreads.roomName })
    .from(chatThreads)
    .where(isMember(userId));
  return rows.map((row) => row.roomName);
}

export async function getUnreadCount(userId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(chatMessages)
    .innerJoin(chatThreads, eq(chatMessages.threadId, chatThreads.id))
    .leftJoin(chatReads, readsJoin(userId))
    .where(and(isMember(userId), unreadFor(userId)));
  return row?.n ?? 0;
}

// Every conversation the user is in, most recent activity first.
export async function listThreads(userId: string): Promise<ThreadSummary[]> {
  const otherId = sql`case when ${chatThreads.userA} = ${userId} then ${chatThreads.userB} else ${chatThreads.userA} end`;
  const unread = db
    .select({ n: count() })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.threadId, chatThreads.id),
        ne(chatMessages.senderId, userId),
        isNull(chatMessages.deletedAt),
        or(
          isNull(chatReads.lastReadAt),
          gt(chatMessages.createdAt, chatReads.lastReadAt),
        ),
      ),
    );

  const rows = await db
    .select({
      roomName: chatThreads.roomName,
      lastMessageAt: chatThreads.lastMessageAt,
      otherId: user.id,
      otherName: user.name,
      otherImage: user.image,
      unread: sql<number>`(${unread})::int`,
    })
    .from(chatThreads)
    .innerJoin(user, eq(user.id, otherId))
    .leftJoin(chatReads, readsJoin(userId))
    .where(isMember(userId))
    .orderBy(
      desc(
        sql`coalesce(${chatThreads.lastMessageAt}, ${chatThreads.createdAt})`,
      ),
    );

  return rows.map((row) => ({
    roomName: row.roomName,
    lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
    other: { id: row.otherId, name: row.otherName, image: row.otherImage },
    unread: row.unread,
  }));
}

// The thread for a room name, but only if the user is one of its two members.
export async function getThreadForMember(roomName: string, userId: string) {
  const [thread] = await db
    .select({
      id: chatThreads.id,
      userA: chatThreads.userA,
      userB: chatThreads.userB,
    })
    .from(chatThreads)
    .where(and(eq(chatThreads.roomName, roomName), isMember(userId)))
    .limit(1);
  return thread ?? null;
}

// The parent of a live, not-adopted listing, for starting a chat from its page.
export async function getCatOwnerForChat(
  catId: number,
): Promise<ChatUser | null> {
  if (!Number.isSafeInteger(catId) || catId < 1) return null;
  const [row] = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(cats)
    .innerJoin(user, eq(cats.userId, user.id))
    .where(and(eq(cats.id, catId), ne(cats.status, "adopted"), isLiveListing))
    .limit(1);
  return row ?? null;
}

// How many conversations this user has started since `since`.
export async function countThreadsStartedSince(userId: string, since: Date) {
  const [row] = await db
    .select({ n: count() })
    .from(chatThreads)
    .where(
      and(eq(chatThreads.startedBy, userId), gte(chatThreads.createdAt, since)),
    );
  return row?.n ?? 0;
}

export async function markThreadRead(threadId: string, userId: string) {
  const now = new Date();
  await db
    .insert(chatReads)
    .values({ threadId, userId, lastReadAt: now })
    .onConflictDoUpdate({
      target: [chatReads.threadId, chatReads.userId],
      set: { lastReadAt: now },
    });
}

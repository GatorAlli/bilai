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
import { CHAT_MESSAGE_MAX_LENGTH } from "@/lib/chat-limits";
import { roomNameFromChannel } from "@/lib/chat-rooms";
import { isLiveListing } from "@/lib/listing-expiry";
import { isPublicId } from "@/lib/public-id";

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
  publicId: string,
): Promise<ChatUser | null> {
  if (!isPublicId(publicId)) return null;
  const [row] = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(cats)
    .innerJoin(user, eq(cats.userId, user.id))
    .where(
      and(
        eq(cats.publicId, publicId),
        ne(cats.status, "adopted"),
        isLiveListing,
      ),
    )
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

// --- Webhook mirror ---------------------------------------------------------

// A chat message as Ably's SDK decodes it from a webhook payload
// (Message.fromEncodedArray). Checked against live messages: `action` is
// "message.create" | "message.update" | "message.delete", `timestamp` stays
// the original send time on edits and deletes, `version.serial` grows with
// each change, and the text is in `data.text`.
export type DecodedChatMessage = {
  action?: string | number;
  serial?: string;
  clientId?: string;
  timestamp?: number;
  version?: { serial?: string } | string;
  data?: unknown;
};

type Action = "create" | "update" | "delete";

// Ably's docs also describe the wire form (0 create, 1 update, 2 delete,
// 4 summary) and past-tense names, so accept those too.
function actionOf(raw: DecodedChatMessage["action"]): Action | null {
  switch (raw) {
    case "message.create":
    case "message.created":
    case 0:
      return "create";
    case "message.update":
    case "message.updated":
    case 1:
      return "update";
    case "message.delete":
    case "message.deleted":
    case 2:
      return "delete";
    default:
      return null; // summaries (reaction totals) and anything unknown
  }
}

function textOf(data: unknown) {
  const parsed = typeof data === "string" ? safeJson(data) : data;
  const text =
    parsed && typeof parsed === "object" && "text" in parsed
      ? (parsed as { text: unknown }).text
      : "";
  return typeof text === "string" ? text : "";
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// Mirrors one channel's batch of chat messages into chat_messages. Safe to run
// more than once for the same messages (Ably may redeliver a webhook): rows are
// keyed by serial, and an update or delete only applies if its version serial
// is newer than the one stored.
export async function recordChatMessages(
  channel: string,
  messages: DecodedChatMessage[],
) {
  const roomName = roomNameFromChannel(channel);
  const [thread] = await db
    .select({
      id: chatThreads.id,
      userA: chatThreads.userA,
      userB: chatThreads.userB,
    })
    .from(chatThreads)
    .where(eq(chatThreads.roomName, roomName))
    .limit(1);
  if (!thread) {
    console.warn(`[chat webhook] no thread for room ${roomName}`);
    return;
  }

  let newest: Date | null = null;
  for (const message of messages) {
    const action = actionOf(message.action);
    const { serial, clientId } = message;
    if (!action || !serial || !clientId) continue;
    if (clientId !== thread.userA && clientId !== thread.userB) {
      console.warn(`[chat webhook] sender is not in room ${roomName}`);
      continue;
    }

    const versionSerial =
      (typeof message.version === "string"
        ? message.version
        : message.version?.serial) ?? serial;
    const createdAt = new Date(message.timestamp ?? Date.now());
    let text = textOf(message.data);
    if (text.length > CHAT_MESSAGE_MAX_LENGTH) {
      console.warn(
        `[chat webhook] message over ${CHAT_MESSAGE_MAX_LENGTH} chars in room ${roomName}; storing it cut short`,
      );
      text = text.slice(0, CHAT_MESSAGE_MAX_LENGTH);
    }
    const now = new Date();
    const row = {
      serial,
      threadId: thread.id,
      senderId: clientId,
      versionSerial,
      createdAt,
      text: action === "delete" ? "" : text,
      editedAt: action === "update" ? now : null,
      deletedAt: action === "delete" ? now : null,
    };

    if (action === "create") {
      await db.insert(chatMessages).values(row).onConflictDoNothing();
      if (!newest || createdAt > newest) newest = createdAt;
    } else {
      // Insert covers an update/delete that arrives before its create.
      await db
        .insert(chatMessages)
        .values(row)
        .onConflictDoUpdate({
          target: chatMessages.serial,
          set:
            action === "update"
              ? { text: row.text, editedAt: now, versionSerial }
              : { text: "", deletedAt: now, versionSerial },
          // Serials are ASCII; compare them byte-wise like Ably does.
          setWhere: sql`${chatMessages.versionSerial} collate "C" < ${versionSerial} collate "C"`,
        });
    }
  }

  if (newest) {
    await db
      .update(chatThreads)
      .set({
        lastMessageAt: sql`greatest(coalesce(${chatThreads.lastMessageAt}, ${newest}), ${newest})`,
      })
      .where(eq(chatThreads.id, thread.id));
  }
}

"use server";

import { getSession } from "@/lib/auth";
import {
  getThreadForMember,
  getUnreadCount,
  listThreads,
  markThreadRead,
  type ThreadSummary,
} from "@/lib/chat";

// Server actions used by the chat dock. Each re-derives the user from the
// session; nothing the browser sends is trusted.

export async function listMyThreads(): Promise<ThreadSummary[]> {
  const session = await getSession();
  if (!session?.user) return [];
  return listThreads(session.user.id);
}

export async function getMyUnreadCount(): Promise<number> {
  const session = await getSession();
  if (!session?.user) return 0;
  return getUnreadCount(session.user.id);
}

// Marks a conversation read for the signed-in user (only if they're in it).
export async function markRead(roomName: string): Promise<void> {
  const session = await getSession();
  if (!session?.user || typeof roomName !== "string") return;
  const thread = await getThreadForMember(roomName, session.user.id);
  if (thread) await markThreadRead(thread.id, session.user.id);
}

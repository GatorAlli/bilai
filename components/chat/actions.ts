"use server";

import { getSession } from "@/lib/auth";
import { listThreads, type ThreadSummary } from "@/lib/chat";

// Server actions used by the chat dock. Each re-derives the user from the
// session; nothing the browser sends is trusted.

export async function listMyThreads(): Promise<ThreadSummary[]> {
  const session = await getSession();
  if (!session?.user) return [];
  return listThreads(session.user.id);
}

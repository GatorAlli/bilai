import { getSession } from "@/lib/auth";
import { ablyServerClient } from "@/lib/ably";
import { getThreadRoomNames } from "@/lib/chat";

// What a user may do in each of their own chat rooms. Reactions
// (annotation-*) and presence are deliberately left out; typing indicators
// ride on publish/subscribe.
const ROOM_OPS = [
  "publish",
  "subscribe",
  "history",
  "message-update-own",
  "message-delete-own",
];

// Signs an Ably token request scoped to the signed-in user's id, so the
// browser never sees ABLY_API_KEY. Ably's client SDKs call this via
// ClientOptions.authUrl whenever they need a (new) token, and the chat dock
// calls auth.authorize() after starting a thread so the new room is included.
//
// The capability lists only rooms from chat_threads that the user belongs to:
// this, not the UI, is what stops someone reading or posting in another
// pair's conversation.
export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return new Response("Not signed in", { status: 401 });
  }

  const rooms = await getThreadRoomNames(session.user.id);
  const capability: Record<string, string[]> = Object.fromEntries(
    rooms.map((room) => [room, ROOM_OPS]),
  );
  // Ably needs at least one entry. A private per-user channel also leaves
  // room for live unread updates later.
  capability[`inbox:${session.user.id}`] = ["subscribe"];

  const tokenRequest = await ablyServerClient.auth.createTokenRequest({
    clientId: session.user.id,
    capability: JSON.stringify(capability),
  });

  return Response.json(tokenRequest, {
    headers: { "Cache-Control": "no-store" },
  });
}

// Pure helpers for Ably Chat room names. No DB or server imports, so the
// browser, the server and vitest can all use them.
//
// A conversation is one room per pair of users: "dm:<userA>:<userB>", with the
// two user ids sorted by JavaScript's `<` (code-unit order). chat_threads has a
// matching CHECK (user_a COLLATE "C" < user_b COLLATE "C"), so the database and
// this sort always agree. better-auth ids are alphanumeric, so ":" is a safe
// separator.

export const DM_ROOM_PREFIX = "dm:";

// Ably Chat rooms are backed by a Pub/Sub channel named "<room>::$chat".
// Webhooks report the channel name, so strip the suffix to get the room.
const CHAT_CHANNEL_SUFFIX = "::$chat";

const USER_ID = /^[A-Za-z0-9_-]+$/;

export function pairFor(a: string, b: string) {
  if (a === b) throw new Error("A chat needs two different users");
  if (!USER_ID.test(a) || !USER_ID.test(b)) {
    throw new Error("Unexpected user id format");
  }
  const [userA, userB] = a < b ? [a, b] : [b, a];
  return { userA, userB, roomName: `${DM_ROOM_PREFIX}${userA}:${userB}` };
}

// "dm:a:b" -> { userA: "a", userB: "b" }, or null for anything else
// (including a pair that isn't in sorted order).
export function parseDmRoomName(roomName: string) {
  if (!roomName.startsWith(DM_ROOM_PREFIX)) return null;
  const parts = roomName.slice(DM_ROOM_PREFIX.length).split(":");
  if (parts.length !== 2) return null;
  const [userA, userB] = parts;
  if (!USER_ID.test(userA) || !USER_ID.test(userB) || !(userA < userB)) {
    return null;
  }
  return { userA, userB };
}

export function roomNameFromChannel(channel: string) {
  return channel.endsWith(CHAT_CHANNEL_SUFFIX)
    ? channel.slice(0, -CHAT_CHANNEL_SUFFIX.length)
    : channel;
}

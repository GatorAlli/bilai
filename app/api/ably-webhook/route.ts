import { createHmac, timingSafeEqual } from "node:crypto";
import { Message } from "@ably/pubsub-server";
import { recordChatMessages, type DecodedChatMessage } from "@/lib/chat";

// Ably integration rule -> webhook for chat rooms (source "channel.message",
// channel filter ^dm:, signed with the ABLY_API_KEY key). Mirrors each chat
// message, edit and delete into Postgres. Setup steps: docs/ably_setup.md.
//
// A route rather than a server action because Ably POSTs to a real URL.
// There is no session here: the HMAC signature is the authentication.

const [KEY_NAME = "", KEY_SECRET = ""] = (process.env.ABLY_API_KEY ?? "").split(
  ":",
);

function isSignedByAbly(body: string, request: Request) {
  const keyName = request.headers.get("x-ably-key");
  const signature = request.headers.get("x-ably-signature");
  if (!KEY_SECRET || !signature || keyName !== KEY_NAME) return false;
  const expected = Buffer.from(
    createHmac("sha256", KEY_SECRET).update(body).digest("base64"),
  );
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

type Batch = { channel: string; messages: unknown[] };

// Accepts the batched form ({ items: [{ name, data: { channelId, messages } }] })
// and the single enveloped form ({ channel, messages }).
function batchesOf(payload: unknown): Batch[] {
  if (!payload || typeof payload !== "object") return [];
  const p = payload as {
    items?: {
      name?: string;
      data?: { channelId?: string; messages?: unknown[] };
    }[];
    channel?: string;
    messages?: unknown[];
  };
  if (Array.isArray(p.items)) {
    return p.items.flatMap((item) =>
      item.name === "channel.message" &&
      typeof item.data?.channelId === "string" &&
      Array.isArray(item.data.messages)
        ? [{ channel: item.data.channelId, messages: item.data.messages }]
        : [],
    );
  }
  if (typeof p.channel === "string" && Array.isArray(p.messages)) {
    return [{ channel: p.channel, messages: p.messages }];
  }
  return [];
}

export async function POST(request: Request) {
  // Read the raw text: the signature covers these exact bytes.
  const body = await request.text();
  if (!isSignedByAbly(body, request)) {
    return new Response("Bad signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  // Written before replying, so a failure returns 500 and Ably retries.
  // recordChatMessages is idempotent, so a retry can't duplicate rows.
  for (const { channel, messages } of batchesOf(payload)) {
    const decoded = (await Message.fromEncodedArray(
      messages as Parameters<typeof Message.fromEncodedArray>[0],
    )) as DecodedChatMessage[];
    await recordChatMessages(channel, decoded);
  }

  return new Response(null, { status: 204 });
}

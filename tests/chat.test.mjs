import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

// Same approach as tests/delete-listing.test.mjs: transpile one file and run
// it in a vm context with hand-written mocks, so no database, Ably or Next
// runtime is needed.

const runtimeRequire = createRequire(import.meta.url);

function load(file, mocks = {}, globals = {}) {
  const testModule = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(code, {
    module: testModule,
    exports: testModule.exports,
    console: { error() {}, warn() {} },
    ...globals,
    require: (name) => (name in mocks ? mocks[name] : runtimeRequire(name)),
  });
  return testModule.exports;
}

const schema = load("db/schema.ts");
const limits = load("lib/chat-limits.ts");
const rooms = load("lib/chat-rooms.ts");

// --- openThread -------------------------------------------------------------

const ADOPTER = "adopterId1";
const OWNER = "ownerId2";

function setupOpenThread({
  session = { user: { id: ADOPTER } },
  owner = { id: OWNER, name: "Owner", image: null },
  existing = false,
  startedThisHour = 1,
} = {}) {
  const inserted = [];
  const deleted = [];
  const db = {
    insert: () => ({
      values: (row) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            inserted.push(row);
            return existing ? [] : [{ id: "thread-1" }];
          },
        }),
      }),
    }),
    delete: () => ({
      where: async (condition) => {
        deleted.push(condition);
      },
    }),
  };
  const action = load("app/(pages)/find_a_cat/[id]/chat-actions.ts", {
    "@/db": { db },
    "@/db/schema": schema,
    "@/lib/auth": { getSession: async () => session },
    "@/lib/chat": {
      getCatOwnerForChat: async () => owner,
      countThreadsStartedSince: async () => startedThisHour,
    },
    "@/lib/chat-limits": limits,
    "@/lib/chat-rooms": rooms,
  });
  return { openThread: action.openThread, inserted, deleted };
}

test("openThread refuses signed-out visitors", async () => {
  const { openThread, inserted } = setupOpenThread({ session: null });
  const result = await openThread(1);
  assert.equal(result.ok, false);
  assert.equal(inserted.length, 0);
});

test("openThread refuses a missing, expired or adopted listing", async () => {
  const { openThread, inserted } = setupOpenThread({ owner: null });
  const result = await openThread(1);
  assert.equal(result.ok, false);
  assert.equal(inserted.length, 0);
});

test("openThread refuses chatting about your own listing", async () => {
  const { openThread, inserted } = setupOpenThread({
    session: { user: { id: OWNER } },
  });
  const result = await openThread(1);
  assert.deepEqual(
    { ok: result.ok, error: result.error },
    { ok: false, error: "This is your own listing." },
  );
  assert.equal(inserted.length, 0);
});

test("openThread stores the sorted pair and who started it", async () => {
  const { openThread, inserted } = setupOpenThread();
  const result = await openThread(1);
  const { userA, userB, roomName } = rooms.pairFor(ADOPTER, OWNER);
  assert.equal(result.ok, true);
  assert.equal(result.roomName, roomName);
  assert.equal(result.other.id, OWNER);
  assert.deepEqual(
    { ...inserted[0] },
    { userA, userB, roomName, startedBy: ADOPTER },
  );
});

test("openThread over the hourly limit removes the new thread", async () => {
  const { openThread, deleted } = setupOpenThread({
    startedThisHour: limits.MAX_NEW_THREADS_PER_HOUR + 1,
  });
  const result = await openThread(1);
  assert.equal(result.ok, false);
  assert.equal(deleted.length, 1);
});

test("openThread never blocks reopening an existing chat", async () => {
  const { openThread, deleted } = setupOpenThread({
    existing: true,
    startedThisHour: limits.MAX_NEW_THREADS_PER_HOUR + 50,
  });
  const result = await openThread(1);
  assert.equal(result.ok, true);
  assert.equal(deleted.length, 0);
});

// --- Ably webhook -----------------------------------------------------------

const KEY_NAME = "app.key";
const KEY_SECRET = "s3cret";

function setupWebhook({ failWrite = false } = {}) {
  const recorded = [];
  const route = load(
    "app/api/ably-webhook/route.ts",
    {
      "@ably/pubsub-server": {
        Message: { fromEncodedArray: async (messages) => messages },
      },
      "@/lib/chat": {
        recordChatMessages: async (channel, messages) => {
          if (failWrite) throw new Error("Database unavailable");
          recorded.push({ channel, count: messages.length });
        },
      },
    },
    {
      process: { env: { ABLY_API_KEY: `${KEY_NAME}:${KEY_SECRET}` } },
      Buffer,
      Response,
    },
  );
  return { POST: route.POST, recorded };
}

function signedRequest(payload, { secret = KEY_SECRET, key = KEY_NAME } = {}) {
  const body = JSON.stringify(payload);
  return new Request("http://localhost/api/ably-webhook", {
    method: "POST",
    body,
    headers: {
      "x-ably-key": key,
      "x-ably-signature": createHmac("sha256", secret)
        .update(body)
        .digest("base64"),
    },
  });
}

const batch = {
  items: [
    {
      name: "channel.message",
      data: { channelId: "dm:a:b::$chat", messages: [{}, {}] },
    },
    { name: "channel.presence", data: { channelId: "x", messages: [{}] } },
  ],
};

test("webhook rejects a bad signature or the wrong key", async () => {
  const { POST, recorded } = setupWebhook();
  assert.equal(
    (await POST(signedRequest(batch, { secret: "nope" }))).status,
    401,
  );
  assert.equal(
    (await POST(signedRequest(batch, { key: "other.key" }))).status,
    401,
  );
  assert.equal(recorded.length, 0);
});

test("webhook records only channel.message batches", async () => {
  const { POST, recorded } = setupWebhook();
  const response = await POST(signedRequest(batch));
  assert.equal(response.status, 204);
  assert.deepEqual(
    recorded.map((r) => ({ ...r })),
    [{ channel: "dm:a:b::$chat", count: 2 }],
  );
});

test("webhook accepts the single enveloped form", async () => {
  const { POST, recorded } = setupWebhook();
  const response = await POST(
    signedRequest({ channel: "dm:a:b::$chat", messages: [{}] }),
  );
  assert.equal(response.status, 204);
  assert.equal(recorded.length, 1);
});

test("webhook lets a failed write surface as 500 so Ably retries", async () => {
  const { POST } = setupWebhook({ failWrite: true });
  await assert.rejects(() => POST(signedRequest(batch)));
});

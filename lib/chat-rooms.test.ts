import { describe, expect, it } from "vitest";
import { pairFor, parseDmRoomName, roomNameFromChannel } from "./chat-rooms";

const A = "aZ9mQ2"; // "B..." sorts before "a..." in code-unit order
const B = "Bk4xT7";

describe("pairFor", () => {
  it("gives the same room whichever user starts", () => {
    expect(pairFor(A, B)).toEqual(pairFor(B, A));
  });

  it("sorts by code units (uppercase before lowercase), like COLLATE C", () => {
    expect(pairFor(A, B)).toEqual({
      userA: B,
      userB: A,
      roomName: `dm:${B}:${A}`,
    });
  });

  it("rejects chatting with yourself", () => {
    expect(() => pairFor(A, A)).toThrow();
  });

  it("rejects ids that could break the room name", () => {
    expect(() => pairFor("a:b", B)).toThrow();
    expect(() => pairFor(A, "")).toThrow();
  });
});

describe("parseDmRoomName", () => {
  it("round-trips pairFor", () => {
    const { userA, userB, roomName } = pairFor(A, B);
    expect(parseDmRoomName(roomName)).toEqual({ userA, userB });
  });

  it.each([
    "general",
    "dm:",
    "dm:onlyone",
    `dm:${A}:${B}`, // not in sorted order
    `dm:${B}:${A}:extra`,
    `dm:${B}:${B}`,
  ])("rejects %s", (name) => {
    expect(parseDmRoomName(name)).toBeNull();
  });
});

describe("roomNameFromChannel", () => {
  it("strips the Ably Chat channel suffix", () => {
    expect(roomNameFromChannel("dm:x:y::$chat")).toBe("dm:x:y");
  });

  it("leaves a bare room name alone", () => {
    expect(roomNameFromChannel("dm:x:y")).toBe("dm:x:y");
  });
});

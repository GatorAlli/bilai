import { randomInt } from "node:crypto";

// Listings are addressed by a random 8-character id (`gj34jfxk`) instead of
// their sequential database id, so URLs and photo keys can't be enumerated.
// 36^8 ≈ 2.8 trillion ids; the unique constraint on cats.public_id catches the
// (very unlikely) collision.
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
export const PUBLIC_ID_LENGTH = 8;
const PUBLIC_ID_PATTERN = /^[a-z0-9]{8}$/;

export function newPublicId() {
  let id = "";
  for (let i = 0; i < PUBLIC_ID_LENGTH; i++) {
    id += ALPHABET[randomInt(ALPHABET.length)];
  }
  return id;
}

export function isPublicId(value: unknown): value is string {
  return typeof value === "string" && PUBLIC_ID_PATTERN.test(value);
}

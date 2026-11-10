import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cats } from "@/db/schema";
import type { ContactMethod } from "@/lib/cat-limits";

// TODO: replace with the phone number from the user's profile once that
// column exists. Keep the E.164 format (+880...) so the links below work.
const PLACEHOLDER_PHONE = "+8801732290601";

export async function getUserPhone(userId: string): Promise<string | null> {
  void userId;
  return PLACEHOLDER_PHONE;
}

// Only what the contact action needs. Never select the phone number into
// anything that is rendered on a page.
export async function getCatContact(catId: number) {
  if (!Number.isSafeInteger(catId) || catId < 1) return null;
  const [cat] = await db
    .select({
      id: cats.id,
      name: cats.name,
      status: cats.status,
      userId: cats.userId,
      contactWhatsapp: cats.contactWhatsapp,
      contactCall: cats.contactCall,
    })
    .from(cats)
    .where(eq(cats.id, catId))
    .limit(1);
  return cat ?? null;
}

export function buildContactUrl(
  method: ContactMethod,
  phone: string,
  cat: { id: number; name: string },
) {
  if (method === "call") return `tel:${phone}`;

  // wa.me wants the full international number as digits only.
  const digits = phone.replace(/\D/g, "");
  const baseUrl = process.env.BETTER_AUTH_URL?.replace(/\/$/, "");
  const message = baseUrl
    ? `Hi! I saw ${cat.name} on Bilai and would like to know more: ${baseUrl}/find_a_cat/${cat.id}`
    : `Hi! I saw ${cat.name} on Bilai and would like to know more.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

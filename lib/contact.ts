import "server-only";

import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { cats, user } from "@/db/schema";
import type { ContactMethod } from "@/lib/cat-limits";
import { PHONE_TAKEN_ERROR } from "@/lib/phone";

// The database keeps 8801712345678. We hand out +8801712345678, which works
// for tel: links, and buildContactUrl strips it back to digits for wa.me.
export async function getUserPhone(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ phone: user.phone })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return row?.phone ? `+${row.phone}` : null;
}

// For people who have no number yet (Google sign-up, or accounts made before
// phones existed). `phone` must already be normalized by normalizeBdPhone.
export async function saveUserPhone(
  userId: string,
  phone: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const taken = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.phone, phone), ne(user.id, userId)))
    .limit(1);
  if (taken.length > 0) return { ok: false, error: PHONE_TAKEN_ERROR };

  try {
    await db
      .update(user)
      .set({ phone, updatedAt: new Date() })
      .where(eq(user.id, userId));
  } catch (err) {
    // Two people saving the same number at once: the unique constraint wins.
    console.error(err);
    return { ok: false, error: PHONE_TAKEN_ERROR };
  }
  return { ok: true };
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

"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { saveUserPhone } from "@/lib/contact";
import { normalizeBdPhone, PHONE_ERROR } from "@/lib/phone";

export type EditResult = { ok: true } | { ok: false; error: string };

export async function updateProfile(input: {
  name: string;
  phone: string;
}): Promise<EditResult> {
  // Server actions can be called directly, so check who is asking here.
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "Please log in first." };
  const current = session.user;

  const name = String(input?.name ?? "").trim();
  const rawPhone = String(input?.phone ?? "").trim();

  if (!name) return { ok: false, error: "Please enter your name." };
  if (name.length > 100) {
    return { ok: false, error: "Your name is too long." };
  }

  // People with a number must keep one. People without can leave it empty.
  let phone: string | null = null;
  if (rawPhone || current.phone) {
    phone = normalizeBdPhone(rawPhone);
    if (!phone) return { ok: false, error: PHONE_ERROR };
  }

  if (phone && phone !== current.phone) {
    const saved = await saveUserPhone(current.id, phone);
    if (!saved.ok) return saved;
  }

  if (name !== current.name) {
    try {
      await db
        .update(user)
        .set({ name, updatedAt: new Date() })
        .where(eq(user.id, current.id));
    } catch (err) {
      console.error(err);
      return { ok: false, error: "Couldn't save your changes. Please try again." };
    }
  }

  return { ok: true };
}

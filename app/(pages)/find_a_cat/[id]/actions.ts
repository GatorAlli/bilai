"use server";

import { getSession } from "@/lib/auth";
import { CONTACT_METHODS, type ContactMethod } from "@/lib/cat-limits";
import { buildContactUrl, getCatContact, getUserPhone } from "@/lib/contact";

export type ContactResult = { ok: true; url: string } | { ok: false; error: string };

// Returns the WhatsApp or tel: link for one cat. The number is only sent
// when a logged-in user asks for it, so it never sits in the page HTML.
export async function getContactUrl(
  catId: number,
  method: ContactMethod,
): Promise<ContactResult> {
  // Server actions can be called directly, so check everything here.
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "Please log in to contact." };

  if (!(CONTACT_METHODS as readonly string[]).includes(method)) {
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  const cat = await getCatContact(Number(catId));
  if (!cat) return { ok: false, error: "This cat is no longer listed." };
  if (cat.status === "adopted") {
    return { ok: false, error: "This cat has already been adopted." };
  }
  const allowed = method === "whatsapp" ? cat.contactWhatsapp : cat.contactCall;
  if (!allowed) {
    return { ok: false, error: "The parent doesn't accept this contact method." };
  }

  const phone = await getUserPhone(cat.userId);
  if (!phone) {
    return { ok: false, error: "The parent hasn't added a phone number yet." };
  }

  return { ok: true, url: buildContactUrl(method, phone, cat) };
}

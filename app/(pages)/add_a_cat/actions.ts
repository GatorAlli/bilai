"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { db } from "@/db";
import { catImages, cats } from "@/db/schema";
import { getSession } from "@/lib/auth";
import {
  CONTACT_METHODS,
  MAX_DESCRIPTION_LENGTH,
  MAX_IMAGES,
  MAX_REHOMING_REASON_LENGTH,
  MAX_STORED_SIZE_BYTES,
  MAX_TEMPERAMENT_LENGTH,
  YES_NO_UNKNOWN,
} from "@/lib/cat-limits";
import { getUserPhone, saveUserPhone } from "@/lib/contact";
import { purgeExpiredListings } from "@/lib/listing-expiry";
import { isValidLocation } from "@/lib/locations";
import { normalizeBdPhone, PHONE_ERROR } from "@/lib/phone";
import { deleteCatPhotos, putCatPhoto } from "@/lib/cloudflareR2";
import { newPublicId } from "@/lib/public-id";
import { catPhotoKey, isWebp } from "@/lib/uploads";

const GENDERS = ["male", "female", "unknown"] as const;

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function submitForm(
  formData: FormData,
): Promise<ActionResult | never> {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "Please log in first." };
  const userId = session.user.id;

  const name = String(formData.get("name") ?? "").trim();
  const breed = String(formData.get("breed") ?? "").trim();
  const district = String(formData.get("district") ?? "").trim();
  const area = String(formData.get("area") ?? "").trim();
  const gender = String(formData.get("gender") ?? "");
  const vaccinated = String(formData.get("vaccinated") ?? "");
  const neutered = String(formData.get("neutered") ?? "");
  // Optional text fields: empty becomes null.
  const optional = (key: string, max: number) =>
    String(formData.get(key) ?? "")
      .trim()
      .slice(0, max) || null;
  const temperament = optional("temperament", MAX_TEMPERAMENT_LENGTH);
  const description = optional("description", MAX_DESCRIPTION_LENGTH);
  const rehomingReason = optional("rehomingReason", MAX_REHOMING_REASON_LENGTH);
  const contactMethods = formData.getAll("contactMethods").map(String);
  const years = Number(formData.get("ageYears"));
  const months = Number(formData.get("ageMonths"));

  if (!name) return { ok: false, error: "Name is required." };
  if (!breed) return { ok: false, error: "Breed is required." };
  if (!district) return { ok: false, error: "Please choose a district." };
  if (!area) return { ok: false, error: "Please choose an area." };
  if (!isValidLocation(district, area)) {
    return {
      ok: false,
      error: "Please pick a district and area from the lists.",
    };
  }
  if (!(GENDERS as readonly string[]).includes(gender)) {
    return { ok: false, error: "Please choose a gender." };
  }
  if (!(YES_NO_UNKNOWN as readonly string[]).includes(vaccinated)) {
    return { ok: false, error: "Please say whether the cat is vaccinated." };
  }
  if (!(YES_NO_UNKNOWN as readonly string[]).includes(neutered)) {
    return {
      ok: false,
      error: "Please say whether the cat is spayed/neutered.",
    };
  }
  if (!Number.isInteger(years) || years < 0 || years > 30) {
    return { ok: false, error: "Years must be between 0 and 30." };
  }
  if (!Number.isInteger(months) || months < 0 || months > 11) {
    return { ok: false, error: "Months must be between 0 and 11." };
  }
  if (years === 0 && months === 0) {
    return { ok: false, error: "Please enter the cat's age." };
  }
  if (
    contactMethods.length === 0 ||
    contactMethods.some(
      (m) => !(CONTACT_METHODS as readonly string[]).includes(m),
    )
  ) {
    return {
      ok: false,
      error: "Please choose how adopters can contact you.",
    };
  }

  const files = formData
    .getAll("images")
    .filter((v): v is File => v instanceof File);
  const captions = formData.getAll("captions").map(String);
  if (files.length === 0) {
    return { ok: false, error: "Please add at least one photo." };
  }
  if (files.length > MAX_IMAGES) {
    return { ok: false, error: `You can add up to ${MAX_IMAGES} photos.` };
  }
  if (captions.length !== files.length) {
    console.error(
      `submitForm: ${files.length} images but ${captions.length} captions.`,
    );
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  // Read and validate everything BEFORE uploading anything.
  const buffers: Buffer[] = [];
  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > MAX_STORED_SIZE_BYTES) {
      console.error(
        `submitForm: image is ${buf.length} bytes, over the limit.`,
      );
      return { ok: false, error: "One of the photos is too large." };
    }
    if (!isWebp(buf)) {
      console.error("submitForm: uploaded image is not WebP.");
      return { ok: false, error: "Upload failed. Please try again." };
    }
    buffers.push(buf);
  }

  // Adopters reach the lister on the number from their profile. Google
  // sign-ups (and older accounts) have none yet, so take it from this form.
  if (!(await getUserPhone(userId))) {
    const phone = normalizeBdPhone(String(formData.get("phone") ?? ""));
    if (!phone) return { ok: false, error: PHONE_ERROR };
    const saved = await saveUserPhone(userId, phone);
    if (!saved.ok) return saved;
  }

  // Insert the listing first: the unique public_id claims the photo keys
  // (cats/<publicId>-<n>.webp) before anything is uploaded, so a colliding id
  // can never overwrite another listing's photos. Then upload, then save the
  // photo rows. If anything fails, the row and uploaded photos are removed.
  let catId: number | null = null;
  let keys: string[] = [];
  try {
    for (let attempt = 0; attempt < 3 && catId === null; attempt++) {
      const publicId = newPublicId();
      const [cat] = await db
        .insert(cats)
        .values({
          publicId,
          name,
          breed,
          ageMonths: years * 12 + months,
          area,
          district,
          gender,
          vaccinated,
          neutered,
          temperament,
          description,
          rehomingReason,
          contactWhatsapp: contactMethods.includes("whatsapp"),
          contactCall: contactMethods.includes("call"),
          // status defaults to 'available' in the database
          userId,
        })
        .onConflictDoNothing({ target: cats.publicId })
        .returning({ id: cats.id });
      if (cat) {
        catId = cat.id;
        keys = buffers.map((_, i) => catPhotoKey(publicId, i + 1));
      }
    }
    if (catId === null) throw new Error("Couldn't find a free public id.");

    await Promise.all(buffers.map((buf, i) => putCatPhoto(keys[i], buf)));

    const listingId = catId;
    await db.insert(catImages).values(
      keys.map((key, position) => ({
        catId: listingId,
        key,
        caption: captions[position].trim().slice(0, 200) || null,
        position,
      })),
    );
  } catch (err) {
    console.error(err);
    if (catId !== null) {
      await db.delete(cats).where(eq(cats.id, catId));
      await deleteCatPhotos(keys);
    }
    return { ok: false, error: "Couldn't save the cat. Please try again." };
  }

  after(purgeExpiredListings);
  // Must stay outside the try/catch: redirect() works by throwing.
  redirect("/");
}

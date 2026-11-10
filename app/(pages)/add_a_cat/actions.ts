"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

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
import { isValidLocation } from "@/lib/locations";
import { normalizeBdPhone, PHONE_ERROR } from "@/lib/phone";
import { isWebp } from "@/lib/uploads";

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

  // Read and validate everything BEFORE writing anything to disk.
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

  let catId: number | null = null;
  try {
    const rows: {
      key: string;
      data: string;
      url: string;
      caption: string | null;
      position: number;
    }[] = [];
    for (const [position, buf] of buffers.entries()) {
      const key = `${userId}/${randomUUID()}.webp`;
      rows.push({
        key,
        data: buf.toString("base64"),
        url: `/uploads/${key}`,
        caption: captions[position].trim().slice(0, 200) || null,
        position,
      });
    }

    const [cat] = await db
      .insert(cats)
      .values({
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
      .returning({ id: cats.id });
    catId = cat.id;

    await db
      .insert(catImages)
      .values(rows.map((row) => ({ ...row, catId: cat.id })));
  } catch (err) {
    // Remove a partially created listing if saving its images failed.
    if (catId !== null) await db.delete(cats).where(eq(cats.id, catId));
    console.error(err);
    return { ok: false, error: "Couldn't save the cat. Please try again." };
  }

  // Must stay outside the try/catch: redirect() works by throwing.
  redirect("/");
}

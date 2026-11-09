"use server";

import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { catImages, cats } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { MAX_IMAGES, MAX_STORED_SIZE_BYTES } from "@/lib/cat-limits";
import { UPLOAD_ROOT, isWebp } from "@/lib/uploads";

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
  const locality = String(formData.get("locality") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const gender = String(formData.get("gender") ?? "");
  const years = Number(formData.get("ageYears"));
  const months = Number(formData.get("ageMonths"));

  if (!name) return { ok: false, error: "Name is required." };
  if (!breed) return { ok: false, error: "Breed is required." };
  if (!locality) return { ok: false, error: "Locality is required." };
  if (!city) return { ok: false, error: "City is required." };
  if (!(GENDERS as readonly string[]).includes(gender)) {
    return { ok: false, error: "Please choose a gender." };
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

  const files = formData
    .getAll("images")
    .filter((v): v is File => v instanceof File);
  const captions = formData.getAll("captions").map(String);
  if (files.length === 0) {
    return { ok: false, error: "Please add at least one image." };
  }
  if (files.length > MAX_IMAGES) {
    return { ok: false, error: `You can upload up to ${MAX_IMAGES} images.` };
  }
  if (captions.length !== files.length) {
    return { ok: false, error: "Invalid submission." };
  }

  // Read and validate everything BEFORE writing anything to disk.
  const buffers: Buffer[] = [];
  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > MAX_STORED_SIZE_BYTES) {
      return { ok: false, error: "An image is too large." };
    }
    if (!isWebp(buf)) {
      return { ok: false, error: "Only WebP images are accepted." };
    }
    buffers.push(buf);
  }

  const writtenKeys: string[] = [];
  let catId: number | null = null;
  try {
    await mkdir(path.join(UPLOAD_ROOT, userId), { recursive: true });

    const rows: {
      key: string;
      url: string;
      caption: string | null;
      position: number;
    }[] = [];
    for (const [position, buf] of buffers.entries()) {
      const key = `${userId}/${randomUUID()}.webp`;
      await writeFile(path.join(UPLOAD_ROOT, key), buf);
      writtenKeys.push(key);
      rows.push({
        key,
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
        locality,
        city,
        gender,
        userId,
      })
      .returning({ id: cats.id });
    catId = cat.id;

    await db
      .insert(catImages)
      .values(rows.map((row) => ({ ...row, catId: cat.id })));
  } catch (err) {
    // Clean up so we don't leave orphan files or a cat with no images.
    await Promise.all(
      writtenKeys.map((k) => rm(path.join(UPLOAD_ROOT, k), { force: true })),
    );
    if (catId !== null) await db.delete(cats).where(eq(cats.id, catId));
    console.error(err);
    return { ok: false, error: "Couldn't save the cat. Please try again." };
  }

  // Must stay outside the try/catch: redirect() works by throwing.
  redirect("/");
}

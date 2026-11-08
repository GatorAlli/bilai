"use server";

import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { cats, catImages } from "@/db/schema";
import { getSession } from "@/lib/auth";
import {
  ACCEPTED_IMAGE_TYPES,
  EXTENSION_BY_TYPE,
  MAX_IMAGES,
  MAX_IMAGE_SIZE_BYTES,
} from "@/lib/cat-limits";
import { R2_BUCKET, R2_PUBLIC_URL, r2 } from "@/lib/r2";

const GENDERS = ["male", "female", "unknown"] as const;

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string };

type ImageMeta = { contentType: string; size: number };

type UploadTarget = { key: string; uploadUrl: string };

/**
 * Step 1: the browser tells us what it wants to upload; we hand back
 * short-lived presigned PUT URLs so the files go straight to R2
 * (Server Actions are capped at 1 MB, so files can't pass through here).
 */
export async function createUploadUrls(
  files: ImageMeta[],
): Promise<ActionResult<UploadTarget[]>> {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "Please log in first." };

  if (!Array.isArray(files) || files.length > MAX_IMAGES) {
    return { ok: false, error: `You can upload up to ${MAX_IMAGES} images.` };
  }

  const targets: UploadTarget[] = [];
  for (const file of files) {
    if (
      !(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.contentType)
    ) {
      return {
        ok: false,
        error: "Only JPG, PNG, GIF or WebP images are allowed.",
      };
    }
    if (
      !Number.isFinite(file.size) ||
      file.size <= 0 ||
      file.size > MAX_IMAGE_SIZE_BYTES
    ) {
      return { ok: false, error: "Each image must be 5 MB or smaller." };
    }

    const key = `cats/${session.user.id}/${randomUUID()}.${EXTENSION_BY_TYPE[file.contentType]}`;
    const uploadUrl = await getSignedUrl(
      r2,
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        ContentType: file.contentType,
        // Signed in, so R2 rejects an upload whose size differs.
        ContentLength: file.size,
      }),
      { expiresIn: 300 },
    );
    targets.push({ key, uploadUrl });
  }

  return { ok: true, data: targets };
}

export type SubmitCatInput = {
  name: string;
  breed: string;
  ageYears: number;
  ageMonths: number;
  locality: string;
  city: string;
  gender: string;
  images: { key: string; caption: string }[];
};

/** Step 2: after the uploads finish, validate everything and save the cat. */
export async function submitForm(
  input: SubmitCatInput,
): Promise<ActionResult | never> {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "Please log in first." };
  const userId = session.user.id;

  const name = String(input.name ?? "").trim();
  const breed = String(input.breed ?? "").trim();
  const locality = String(input.locality ?? "").trim();
  const city = String(input.city ?? "").trim();
  const gender = String(input.gender ?? "");
  const years = Number(input.ageYears);
  const months = Number(input.ageMonths);

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

  const images = Array.isArray(input.images) ? input.images : [];
  if (images.length === 0) {
    return { ok: false, error: "Please add at least one image." };
  }
  if (images.length > MAX_IMAGES) {
    return { ok: false, error: `You can upload up to ${MAX_IMAGES} images.` };
  }
  // Only accept keys that were issued to this user (blocks pointing at others' files).
  const prefix = `cats/${userId}/`;
  const keys = new Set<string>();
  for (const image of images) {
    if (
      typeof image.key !== "string" ||
      !image.key.startsWith(prefix) ||
      image.key.includes("..") ||
      keys.has(image.key)
    ) {
      return { ok: false, error: "Invalid image reference." };
    }
    keys.add(image.key);
  }

  // The neon-http driver doesn't support transactions, so insert the cat
  // first and the images in a single statement after it.
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

  await db.insert(catImages).values(
    images.map((image, position) => ({
      catId: cat.id,
      key: image.key,
      url: `${R2_PUBLIC_URL}/${image.key}`,
      caption:
        String(image.caption ?? "")
          .trim()
          .slice(0, 200) || null,
      position,
    })),
  );

  redirect("/");
}

"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { catImages, cats } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { UPLOAD_ROOT } from "@/lib/uploads";

type DeleteResult = { ok: true } | { ok: false; error: string };

export async function deleteCatListing(catId: number): Promise<DeleteResult> {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "Please log in first." };
  if (!Number.isSafeInteger(catId) || catId < 1) {
    return { ok: false, error: "Invalid listing." };
  }

  const ownedListing = and(eq(cats.id, catId), eq(cats.userId, session.user.id));
  let images: { key: string }[];
  try {
    images = await db
      .select({ key: catImages.key })
      .from(catImages)
      .innerJoin(cats, eq(catImages.catId, cats.id))
      .where(ownedListing);
    // Check ownership in the mutation itself, including concurrent requests.
    // Related image records are removed by the database's cascading foreign key.
    const deleted = await db
      .delete(cats)
      .where(ownedListing)
      .returning({ id: cats.id });
    if (deleted.length === 0) {
      return { ok: false, error: "Listing not found or you don't own it." };
    }
  } catch (error) {
    console.error("Couldn't delete listing", error);
    return { ok: false, error: "Couldn't delete the listing. Please try again." };
  }

  const ownerRoot = path.resolve(UPLOAD_ROOT, session.user.id);
  await Promise.all(
    images.map(async ({ key }) => {
      const file = path.resolve(UPLOAD_ROOT, key);
      // Only remove this owner's uploaded files; never directories or other paths.
      if (!file.startsWith(ownerRoot + path.sep) || !file.endsWith(".webp")) return;
      try {
        await unlink(file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          console.error("Couldn't remove deleted listing photo", error);
        }
      }
    }),
  );

  revalidatePath("/");
  revalidatePath("/find_a_cat");
  revalidatePath(`/find_a_cat/${catId}`);
  return { ok: true };
}

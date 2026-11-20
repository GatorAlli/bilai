"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { catImages, cats } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { deleteCatPhotos } from "@/lib/cloudflareR2";
import { isPublicId } from "@/lib/public-id";
import { isCatPhotoKey } from "@/lib/uploads";

type DeleteResult = { ok: true } | { ok: false; error: string };

export async function deleteCatListing(
  publicId: string,
): Promise<DeleteResult> {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "Please log in first." };
  if (!isPublicId(publicId)) {
    return { ok: false, error: "Invalid listing." };
  }

  const ownedListing = and(
    eq(cats.publicId, publicId),
    eq(cats.userId, session.user.id),
  );
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
    return {
      ok: false,
      error: "Couldn't delete the listing. Please try again.",
    };
  }

  // Only this listing's own photo keys (cats/<publicId>-<n>.webp) are removed
  // from R2.
  await deleteCatPhotos(
    images
      .map(({ key }) => key)
      .filter(
        (key) => isCatPhotoKey(key) && key.startsWith(`cats/${publicId}-`),
      ),
  );

  revalidatePath("/");
  revalidatePath("/find_a_cat");
  revalidatePath(`/find_a_cat/${publicId}`);
  return { ok: true };
}

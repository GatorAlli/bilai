import "server-only";

import { eq, gt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { catImages, cats } from "@/db/schema";
import { removeLocalPhotos } from "@/lib/uploads";

// Every listing, with its photos, is deleted this long after it was posted.
export const LISTING_LIFETIME_DAYS = 7;

// Worked out in the database so every server agrees on "now".
const lifetime = sql`make_interval(days => ${LISTING_LIFETIME_DAYS})`;
const cutoff = sql`now() - ${lifetime}`;
export const isLiveListing = gt(cats.createdAt, cutoff);
const isExpiredListing = lte(cats.createdAt, cutoff);
export const listingSecondsLeft = sql<number>`floor(extract(epoch from (${cats.createdAt} + ${lifetime} - now())))::int`;

// "in 3 days", "in 5 hours", "within the hour"
export function formatTimeLeft(secondsLeft: number) {
  const hours = Math.floor(secondsLeft / 3600);
  if (hours < 1) return "within the hour";
  if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

// Reads already hide expired listings via isLiveListing; this removes their
// rows and photos. Called with after() on busy pages, so it is throttled per
// server instance rather than run on every request.
const PURGE_EVERY_MS = 10 * 60 * 1000;
let lastPurgeAt = 0;

export async function purgeExpiredListings() {
  if (Date.now() - lastPurgeAt < PURGE_EVERY_MS) return;
  lastPurgeAt = Date.now();
  try {
    const images = await db
      .select({ key: catImages.key })
      .from(catImages)
      .innerJoin(cats, eq(catImages.catId, cats.id))
      .where(isExpiredListing);
    // Photo rows go with their listing through the cascading foreign key.
    const deleted = await db
      .delete(cats)
      .where(isExpiredListing)
      .returning({ id: cats.id });
    if (deleted.length === 0) return;
    await removeLocalPhotos(images.map(({ key }) => key));
    console.log(`Removed ${deleted.length} expired cat listing(s).`);
  } catch (error) {
    lastPurgeAt = 0; // try again on the next request
    console.error("Couldn't remove expired listings", error);
  }
}

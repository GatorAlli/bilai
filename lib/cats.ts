import "server-only";

import { asc, count, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { db } from "@/db";
import { catImages, cats, user } from "@/db/schema";

export const CATS_PER_PAGE = 20;
// Deliberately uncached: render these reads under Suspense with cacheComponents.
// Each navigation queries just its requested page, so new listings stay fresh.
export async function getCats({
  page = 1,
}: {
  page?: number;
} = {}) {
  const requestedPage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const offset = (requestedPage - 1) * CATS_PER_PAGE;
  const [items, totals] = await Promise.all([
    db
      .select({
        id: cats.id,
        name: cats.name,
        breed: cats.breed,
        ageMonths: cats.ageMonths,
        gender: cats.gender,
        area: cats.area,
        district: cats.district,
        status: cats.status,
        owner: { id: user.id, name: user.name },
        coverImageUrl: sql<string | null>`(
        select ${catImages.url} from ${catImages}
        where ${catImages.catId} = ${cats.id}
        order by ${catImages.position} asc, ${catImages.id} asc limit 1
      )`,
      })
      .from(cats)
      .innerJoin(user, eq(cats.userId, user.id))
      .orderBy(desc(cats.createdAt), desc(cats.id))
      .limit(CATS_PER_PAGE)
      .offset(offset),
    db.select({ total: count() }).from(cats),
  ]);
  const total = totals[0].total;
  return {
    items,
    total,
    page: requestedPage,
    totalPages: Math.ceil(total / CATS_PER_PAGE),
  };
}

export async function getCat(id: number) {
  if (!Number.isSafeInteger(id) || id < 1) return null;
  const [cat] = await db
    .select({
      ...getTableColumns(cats),
      owner: { id: user.id, name: user.name },
    })
    .from(cats)
    .innerJoin(user, eq(cats.userId, user.id))
    .where(eq(cats.id, id))
    .limit(1);
  if (!cat) return null;
  const images = await db
    .select({
      id: catImages.id,
      url: catImages.url,
      caption: catImages.caption,
      position: catImages.position,
    })
    .from(catImages)
    .where(eq(catImages.catId, id))
    .orderBy(asc(catImages.position), asc(catImages.id));
  return { ...cat, images, coverImageUrl: images[0]?.url ?? null };
}

export function formatCatAge(months: number) {
  if (months === 0) return "Under 1 month";
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  return [
    years ? `${years} year${years === 1 ? "" : "s"}` : "",
    remainder ? `${remainder} month${remainder === 1 ? "" : "s"}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

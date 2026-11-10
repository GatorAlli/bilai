import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  inArray,
  ilike,
  or,
  lte,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import { catImages, cats, user } from "@/db/schema";
import { MAX_FILTER_AGE, type CatFilters } from "@/lib/cat-filters";
import { isLiveListing, listingSecondsLeft } from "@/lib/listing-expiry";

export const CATS_PER_PAGE = 20;

export async function getFeaturedCats() {
  return db
    .select({
      id: cats.id,
      name: cats.name,
      breed: cats.breed,
      ageMonths: cats.ageMonths,
      gender: cats.gender,
      area: cats.area,
      district: cats.district,
      coverImageUrl: sql<string | null>`(
        select ${catImages.url} from ${catImages}
        where ${catImages.catId} = ${cats.id}
        order by ${catImages.position} asc, ${catImages.id} asc limit 1
      )`,
    })
    .from(cats)
    .where(and(eq(cats.status, "available"), isLiveListing))
    .orderBy(sql`random()`)
    .limit(3);
}

// Deliberately uncached: render these reads under Suspense with cacheComponents.
// Each navigation queries just its requested page, so new listings stay fresh.
export async function getCats({
  page = 1,
  filters,
}: {
  page?: number;
  filters?: CatFilters;
} = {}) {
  const requestedPage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const filter = and(
    isLiveListing,
    filters
      ? and(
          ...filters.q
            .split(/\s+/)
            .filter(Boolean)
            .map((word) => {
              const pattern = `%${word.replace(/[\\%_]/g, "\\$&")}%`;
              return or(
                ...[cats.name, cats.breed, cats.area, cats.district].map(
                  (column) => ilike(column, pattern),
                ),
              );
            }),
          filters.minAge > 0 ? gte(cats.ageMonths, filters.minAge) : undefined,
          filters.maxAge < MAX_FILTER_AGE
            ? lte(cats.ageMonths, filters.maxAge)
            : undefined,
          filters.breeds.length ? inArray(cats.breed, filters.breeds) : undefined,
          filters.genders.length
            ? inArray(cats.gender, filters.genders)
            : undefined,
          filters.district ? eq(cats.district, filters.district) : undefined,
          filters.district && filters.area
            ? eq(cats.area, filters.area)
            : undefined,
          filters.vaccinated.length
            ? inArray(cats.vaccinated, filters.vaccinated)
            : undefined,
          filters.neutered.length
            ? inArray(cats.neutered, filters.neutered)
            : undefined,
        )
      : undefined,
  );
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
      .where(filter)
      .orderBy(desc(cats.createdAt), desc(cats.id))
      .limit(CATS_PER_PAGE)
      .offset(offset),
    db.select({ total: count() }).from(cats).where(filter),
  ]);
  const total = totals[0].total;
  return {
    items,
    total,
    page: requestedPage,
    totalPages: Math.ceil(total / CATS_PER_PAGE),
  };
}

export async function getCatBreeds() {
  const rows = await db
    .selectDistinct({ breed: cats.breed })
    .from(cats)
    .where(isLiveListing)
    .orderBy(asc(cats.breed));
  return rows.map(({ breed }) => breed);
}

export async function getCat(id: number) {
  if (!Number.isSafeInteger(id) || id < 1) return null;
  const [cat] = await db
    .select({
      ...getTableColumns(cats),
      // Only whether a number exists: the number itself is sent by the
      // contact action on tap, never rendered into the page.
      owner: {
        id: user.id,
        name: user.name,
        hasPhone: sql<boolean>`${user.phone} is not null`,
      },
    })
    .from(cats)
    .innerJoin(user, eq(cats.userId, user.id))
    .where(and(eq(cats.id, id), isLiveListing))
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

// Everything someone has listed that hasn't expired yet, newest first.
export async function getUserCats(userId: string) {
  return db
    .select({
      id: cats.id,
      name: cats.name,
      breed: cats.breed,
      ageMonths: cats.ageMonths,
      gender: cats.gender,
      area: cats.area,
      district: cats.district,
      status: cats.status,
      secondsLeft: listingSecondsLeft,
      coverImageUrl: sql<string | null>`(
        select ${catImages.url} from ${catImages}
        where ${catImages.catId} = ${cats.id}
        order by ${catImages.position} asc, ${catImages.id} asc limit 1
      )`,
    })
    .from(cats)
    .where(and(eq(cats.userId, userId), isLiveListing))
    .orderBy(desc(cats.createdAt), desc(cats.id));
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

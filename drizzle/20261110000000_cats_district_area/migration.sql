-- Location is now picked as District -> Area (see lib/locations.ts).
-- Not every place is a city, so the columns are renamed to match. Data is kept.
ALTER TABLE "public"."cats" RENAME COLUMN "locality" TO "area";
ALTER TABLE "public"."cats" RENAME COLUMN "city" TO "district";
ALTER INDEX "public"."cats_city_idx" RENAME TO "cats_district_idx";

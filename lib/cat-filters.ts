import { DISTRICT_NAMES, isValidLocation } from "@/lib/locations";

// The last slider stop means any age, including cats older than 20 years.
export const MAX_FILTER_AGE = 240;
export type CatFilters = {
  q: string;
  minAge: number;
  maxAge: number;
  breeds: string[];
  genders: string[];
  district: string;
  area: string;
  vaccinated: string[];
  neutered: string[];
};
export type CatSearchParams = Record<string, string | string[] | undefined>;

export function parseCatFilters(params: CatSearchParams): CatFilters {
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const list = (key: string, allowed?: string[]) => {
    const value = params[key];
    return [
      ...new Set(
        (Array.isArray(value) ? value : value ? [value] : []).filter(
          (item) =>
            item.length > 0 &&
            item.length <= 200 &&
            (!allowed || allowed.includes(item)),
        ),
      ),
    ];
  };
  const age = (key: string, fallback: number) => {
    const value = first(key);
    const number = value ? Number(value) : NaN;
    return Number.isSafeInteger(number) &&
      number >= 0 &&
      number <= MAX_FILTER_AGE
      ? number
      : fallback;
  };
  const minAge = age("minAge", 0);
  const maxAge = age("maxAge", MAX_FILTER_AGE);
  const district = first("district") ?? "";
  const area = first("area") ?? "";
  return {
    q: (first("q") ?? "").trim(),
    minAge: Math.min(minAge, maxAge),
    maxAge: Math.max(minAge, maxAge),
    breeds: list("breed"),
    genders: list("gender", ["male", "female"]),
    district: DISTRICT_NAMES.includes(district) ? district : "",
    area: isValidLocation(district, area) ? area : "",
    vaccinated: list("vaccinated", ["yes", "no"]),
    neutered: list("neutered", ["yes", "no"]),
  };
}

export function catFilterParams(filters: CatFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.minAge > 0) params.set("minAge", String(filters.minAge));
  if (filters.maxAge < MAX_FILTER_AGE)
    params.set("maxAge", String(filters.maxAge));
  for (const breed of filters.breeds) params.append("breed", breed);
  for (const gender of filters.genders) params.append("gender", gender);
  if (filters.district) {
    params.set("district", filters.district);
    if (filters.area) params.set("area", filters.area);
  }
  for (const value of filters.vaccinated) params.append("vaccinated", value);
  for (const value of filters.neutered) params.append("neutered", value);
  return params;
}

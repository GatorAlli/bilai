"use client";

import { useState, type ReactNode } from "react";
import { Slider } from "@base-ui/react/slider";
import { ChevronDown } from "lucide-react";
import { SearchSelect } from "@/components/ui/search-select";
import { DISTRICT_NAMES, getAreaGroups } from "@/lib/locations";
import {
  catFilterParams,
  MAX_FILTER_AGE,
  parseCatFilters,
  type CatFilters as Filters,
} from "@/lib/cat-filters";

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details
      open
      className="group rounded-lg border border-border"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 text-sm font-bold [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          className="size-4 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-border p-3">{children}</div>
    </details>
  );
}

function CheckOptions({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="max-h-56 space-y-3 overflow-y-auto"
    >
      {options.length === 0 && (
        <p className="text-sm text-muted-foreground">No breeds listed yet.</p>
      )}
      {options.map(({ value, label: text }) => (
        <label
          key={value}
          className="flex cursor-pointer items-center gap-3 text-sm"
        >
          <input
            type="checkbox"
            checked={selected.includes(value)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...selected, value]
                  : selected.filter((item) => item !== value),
              )
            }
            className="size-4 shrink-0 accent-[var(--bilai-action)]"
          />
          {text}
        </label>
      ))}
    </div>
  );
}

function ageLabel(months: number) {
  if (months === MAX_FILTER_AGE) return "20+ years";
  if (months === 0) return "0 months";
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  return [years ? `${years}y` : "", remainder ? `${remainder}m` : ""]
    .filter(Boolean)
    .join(" ");
}

const HEALTH_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export default function CatFilters({
  initialFilters,
  breeds,
}: {
  initialFilters: Filters;
  breeds: string[];
}) {
  const [filters, setFilters] = useState(initialFilters);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const entries = [...catFilterParams(filters).entries()];

  return (
    <aside aria-label="Filter cats" className="min-w-0">
      <form action="/find_a_cat" method="get" className="space-y-3">
        {entries.map(([name, value], index) => (
          <input
            key={`${name}-${index}`}
            type="hidden"
            name={name}
            value={value}
          />
        ))}
        <div className="bilai-filter-fields">
          <FilterSection title="Age">
            <Slider.Root
              min={0}
              max={MAX_FILTER_AGE}
              step={1}
              value={[filters.minAge, filters.maxAge]}
              onValueChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  minAge: value[0],
                  maxAge: value[1],
                }))
              }
            >
              <Slider.Control className="flex h-10 w-full touch-none items-center">
                <Slider.Track className="relative h-2 w-full rounded-full bg-muted">
                  <Slider.Indicator className="rounded-full bg-[var(--bilai-action)]" />
                  {[0, 1].map((index) => (
                    <Slider.Thumb
                      key={index}
                      index={index}
                      getAriaLabel={() =>
                        index === 0 ? "Minimum age" : "Maximum age"
                      }
                      getAriaValueText={(_, value) => ageLabel(value)}
                      className="size-5 rounded-full border-2 border-[var(--bilai-action)] bg-card outline-offset-4 focus-visible:outline-2"
                    />
                  ))}
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>
            <div
              className="mt-2 flex justify-between gap-2 text-sm font-medium"
              aria-live="polite"
            >
              <output className="rounded-lg border border-border px-3 py-2">
                {ageLabel(filters.minAge)}
              </output>
              <output className="rounded-lg border border-border px-3 py-2">
                {ageLabel(filters.maxAge)}
              </output>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Move either handle to set an age range.
            </p>
          </FilterSection>
          <FilterSection title="Breed">
            <CheckOptions
              label="Breed"
              options={breeds.map((breed) => ({ value: breed, label: breed }))}
              selected={filters.breeds}
              onChange={(value) => set("breeds", value)}
            />
          </FilterSection>
          <FilterSection title="Gender">
            <CheckOptions
              label="Gender"
              options={[
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
              ]}
              selected={filters.genders}
              onChange={(value) => set("genders", value)}
            />
          </FilterSection>
          <FilterSection title="District">
            <label htmlFor="filter-district" className="sr-only">
              District
            </label>
            <SearchSelect
              id="filter-district"
              items={DISTRICT_NAMES}
              value={filters.district}
              onChange={(district) =>
                setFilters((current) => ({ ...current, district, area: "" }))
              }
              placeholder="All districts"
              popupClassName="bilai-theme"
            />
          </FilterSection>
          {filters.district && (
            <FilterSection title="Area">
              <label htmlFor="filter-area" className="sr-only">
                Area
              </label>
              <SearchSelect
                id="filter-area"
                items={getAreaGroups(filters.district)}
                value={filters.area}
                onChange={(value) => set("area", value)}
                placeholder="All areas"
                popupClassName="bilai-theme"
              />
            </FilterSection>
          )}
          <FilterSection title="Vaccination status">
            <CheckOptions
              label="Vaccination status"
              options={HEALTH_OPTIONS}
              selected={filters.vaccinated}
              onChange={(value) => set("vaccinated", value)}
            />
          </FilterSection>
          <FilterSection title="Spayed / neutered">
            <CheckOptions
              label="Spayed / neutered"
              options={HEALTH_OPTIONS}
              selected={filters.neutered}
              onChange={(value) => set("neutered", value)}
            />
          </FilterSection>
        </div>
        <p className="text-xs text-muted-foreground">
          Selections take effect when you apply filters.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="h-11 rounded-lg bg-secondary px-4 font-bold text-secondary-foreground hover:bg-secondary/85"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={() => setFilters(parseCatFilters({ q: initialFilters.q }))}
            className="h-11 rounded-lg border border-input px-4 text-sm font-semibold hover:bg-muted"
          >
            Clear selections
          </button>
        </div>
      </form>
    </aside>
  );
}

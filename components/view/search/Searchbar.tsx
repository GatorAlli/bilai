"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import { catFilterParams, type CatFilters } from "@/lib/cat-filters";

// The ring sits inside the shared border, so the two halves stay flush.
const searchFocus =
  "focus-visible:outline-2 focus-visible:-outline-offset-3 focus-visible:outline-focus";

export default function Searchbar({ filters }: { filters?: CatFilters } = {}) {
  const submittedQuery = filters?.q ?? "";
  const [query, setQuery] = useState(submittedQuery);
  useEffect(() => {
    const restoreSubmittedQuery = () => setQuery(submittedQuery);
    window.addEventListener("pageshow", restoreSubmittedQuery);
    return () => window.removeEventListener("pageshow", restoreSubmittedQuery);
  }, [submittedQuery]);
  const params = filters ? catFilterParams(filters) : new URLSearchParams();
  params.delete("q");
  return (
    <form action="/find_a_cat" method="get" role="search">
      {[...params.entries()].map(([name, value], index) => (
        <input
          key={`${name}-${index}`}
          type="hidden"
          name={name}
          value={value}
        />
      ))}
      <div className="mt-6 mb-4 flex min-h-12 rounded-[.65rem] border border-ink bg-card print:hidden">
        <input
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, breed or location"
          aria-label="Search name, breed or location"
          className={`min-w-0 flex-1 rounded-l-[.6rem] px-4 py-2 text-[.9375rem] placeholder:text-muted-foreground ${searchFocus}`}
        />
        <button
          type="submit"
          aria-label="Search"
          className={`grid w-12 flex-none place-items-center rounded-r-[.6rem] border-l border-line hover:bg-active ${searchFocus}`}
        >
          <Search className="size-4" aria-hidden />
        </button>
      </div>
    </form>
  );
}

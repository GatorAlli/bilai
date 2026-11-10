"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import { catFilterParams, type CatFilters } from "@/lib/cat-filters";

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
    <div className="wrap">
      <form action="/find_a_cat" method="get" role="search" className="pb-5">
        {[...params.entries()].map(([name, value], index) => (
          <input
            key={`${name}-${index}`}
            type="hidden"
            name={name}
            value={value}
          />
        ))}
        <div className="flex h-12 overflow-hidden rounded-lg border border-mauve-950/20 bg-[#FFFEF7] focus-within:border-mauve-950">
          <input
            type="search"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, breed or location"
            aria-label="Search name, breed or location"
            className="flex-1 bg-transparent px-4 text-sm text-mauve-950 outline-none placeholder:text-mauve-950/50"
          />
          <button
            type="submit"
            aria-label="Search"
            className="flex w-12 items-center justify-center border-l border-mauve-950/20 text-mauve-950 hover:bg-mauve-950 hover:text-white"
          >
            <Search className="size-4" aria-hidden />
          </button>
        </div>
      </form>
    </div>
  );
}

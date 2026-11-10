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
    <form action="/find_a_cat" method="get" role="search">
      {[...params.entries()].map(([name, value], index) => (
        <input
          key={`${name}-${index}`}
          type="hidden"
          name={name}
          value={value}
        />
      ))}
      <div className="bilai-search">
        <input
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, breed or location"
          aria-label="Search name, breed or location"
        />
        <button
          type="submit"
          aria-label="Search"
        >
          <Search className="size-4" aria-hidden />
        </button>
      </div>
    </form>
  );
}

import { Suspense } from "react";
import Link from "next/link";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import BilaiPage from "@/components/view/BilaiPage";
import CatCard from "@/components/view/cat/CatCard";
import Searchbar from "@/components/view/search/Searchbar";
import { getCats, getCatBreeds } from "@/lib/cats";

import CatFilters from "@/components/view/search/CatFilters";
import {
  catFilterParams,
  parseCatFilters,
  type CatSearchParams,
} from "@/lib/cat-filters";

type SearchParams = Promise<CatSearchParams>;

export default function FindCatsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <BilaiPage currentPage="find" mainClassName="bilai-frame bilai-inner">
      <header className="bilai-page-heading">
        <h1>Find a cat</h1>
        <p>Search by name, breed, or area to find cats in Bangladesh.</p>
      </header>
      <Suspense fallback={<Searchbar />}>
        <AppliedSearchbar searchParams={searchParams} />
      </Suspense>
      <Suspense
        fallback={
          <p className="py-8" role="status">
            Loading cats…
          </p>
        }
      >
        <CatResults searchParams={searchParams} />
      </Suspense>
    </BilaiPage>
  );
}

async function AppliedSearchbar({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const filters = parseCatFilters(await searchParams);
  return (
    <Searchbar key={catFilterParams(filters).toString()} filters={filters} />
  );
}

async function CatResults({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = parseCatFilters(params);
  const [results, breeds] = await Promise.all([
    getCats({ page: Number(params.page ?? 1), filters }),
    getCatBreeds(),
  ]);
  const { items, total, page, totalPages } = results;
  const appliedParams = catFilterParams(filters);
  const filterCount = new Set([...appliedParams.keys()].filter((key) => key !== "q")).size;
  const href = (target: number) => {
    const query = new URLSearchParams(appliedParams);
    query.set("page", String(target));
    return `/find_a_cat?${query}`;
  };
  const pages = Array.from(new Set([1, page - 1, page, page + 1, totalPages]))
    .filter((number) => number > 0 && number <= totalPages)
    .sort((a, b) => a - b);
  const pageClass =
    "flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-border px-3 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <>
      <details className="bilai-filter-panel">
        <summary>
          <SlidersHorizontal size={17} aria-hidden="true" />
          Filters{filterCount > 0 ? " (" + filterCount + " applied)" : ""}
          <ChevronDown size={17} aria-hidden="true" />
        </summary>
        <CatFilters
          key={appliedParams.toString()}
          initialFilters={filters}
          breeds={breeds}
        />
      </details>
      <section aria-label="Cat results" className="min-w-0">
        <p className="mb-3 text-sm text-muted-foreground">
          Showing {items.length} of {total} cats
        </p>
        {items.length > 0 ? (
          <div className="bilai-directory-grid">
            {items.map((cat) => (
              <CatCard
                key={cat.id}
                cat={cat}
                nameAs="h2"
                sizes="(max-width: 384px) 100vw, (max-width: 640px) 50vw, (max-width: 1056px) 33vw, 25vw"
              />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-border bg-card p-10 text-center">
            <h2 className="text-lg font-bold">No cats found</h2>
            <p className="mt-2 text-muted-foreground">
              Try changing your filters or check back soon.
            </p>
            <Link
              href="/find_a_cat"
              className="mt-4 inline-block font-bold underline"
            >
              Show all cats
            </Link>
          </div>
        )}
        {totalPages > 0 && (
          <nav
            aria-label="Cat results pages"
            className="mt-8 flex flex-wrap items-center justify-end gap-2"
          >
            {page > 1 ? (
              <Link
                prefetch={false}
                href={href(Math.min(page - 1, totalPages))}
                className={pageClass}
                aria-label="Previous page"
              >
                ‹
              </Link>
            ) : (
              <span aria-disabled="true" className={`${pageClass} opacity-40`}>
                ‹
              </span>
            )}
            {pages.map((number, index) => (
              <span key={number} className="flex items-center gap-2">
                {index > 0 && number - pages[index - 1] > 1 ? (
                  <span className="px-1">…</span>
                ) : null}
                <Link
                  prefetch={false}
                  href={href(number)}
                  aria-label={`Page ${number}`}
                  aria-current={page === number ? "page" : undefined}
                  className={`${pageClass} ${page === number ? "border-secondary bg-secondary text-secondary-foreground" : "bg-card"}`}
                >
                  {number}
                </Link>
              </span>
            ))}
            {page < totalPages ? (
              <Link
                prefetch={false}
                href={href(page + 1)}
                className={pageClass}
                aria-label="Next page"
              >
                ›
              </Link>
            ) : (
              <span aria-disabled="true" className={`${pageClass} opacity-40`}>
                ›
              </span>
            )}
          </nav>
        )}
      </section>
    </>
  );
}

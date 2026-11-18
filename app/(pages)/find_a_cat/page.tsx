import { Suspense } from "react";
import Link from "next/link";
import { after } from "next/server";
import { ChevronDown, LoaderCircle, SlidersHorizontal } from "lucide-react";
import BilaiPage from "@/components/view/BilaiPage";
import CatCard from "@/components/view/cat/CatCard";
import { getCats, getCatBreeds } from "@/lib/cats";
import { headingText, headingTitle } from "@/components/view/styles";
import { purgeExpiredListings } from "@/lib/listing-expiry";

import CatFilters from "@/components/view/search/CatFilters";
import Searchbar from "@/components/view/search/Searchbar";
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
    <BilaiPage currentPage="find" mainClassName="frame pt-6 pb-section">
      <Suspense fallback={null}>
        <CatSearch searchParams={searchParams} />
      </Suspense>
      <header>
        <h1 className={headingTitle}>Find a cat</h1>
        <p className={headingText}>Browse cats for adoption in Bangladesh.</p>
      </header>
      <Suspense
        fallback={
          <p
            className="flex items-center justify-center gap-2 py-8 text-muted-foreground"
            role="status"
          >
            <LoaderCircle
              className="size-4 motion-safe:animate-spin"
              aria-hidden="true"
            />
            Loading cats…
          </p>
        }
      >
        <CatResults searchParams={searchParams} />
      </Suspense>
    </BilaiPage>
  );
}

async function CatSearch({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseCatFilters(await searchParams);
  return (
    <Searchbar key={catFilterParams(filters).toString()} filters={filters} />
  );
}

async function CatResults({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  after(purgeExpiredListings);
  const filters = parseCatFilters(params);
  const [results, breeds] = await Promise.all([
    getCats({ page: Number(params.page ?? 1), filters }),
    getCatBreeds(),
  ]);
  const { items, total, page, totalPages } = results;
  const appliedParams = catFilterParams(filters);
  const filterCount = new Set(
    [...appliedParams.keys()].filter((key) => key !== "q"),
  ).size;
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
      <details className="group mb-6 rounded-[.65rem] border border-line bg-card print:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2 text-[.9375rem] font-bold focus-visible:rounded-[.65rem] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal size={17} aria-hidden="true" />
          Filters{filterCount > 0 ? " (" + filterCount + " applied)" : ""}
          <ChevronDown
            size={17}
            aria-hidden="true"
            className="ml-auto group-open:rotate-180"
          />
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
          <div className="grid grid-cols-1 gap-4 min-[24rem]:grid-cols-2 sm:grid-cols-3 min-[66rem]:grid-cols-4">
            {items.map((cat) => (
              <CatCard
                key={cat.id}
                cat={cat}
                nameAs="h2"
                wholeCardLink
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

import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Cat } from "lucide-react";
import Navbar from "@/components/view/navbar/Navbar";
import Searchbar from "@/components/view/search/Searchbar";
import { CATS_PER_PAGE, formatCatAge, getCats, getCatBreeds } from "@/lib/cats";

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
    <div className="theme-light flex flex-1 flex-col bg-background text-foreground">
      <Navbar currentPage="find" />
      <Suspense fallback={<Searchbar />}>
        <AppliedSearchbar searchParams={searchParams} />
      </Suspense>
      <main className="wrap py-8">
        <h1 className="font-heading text-3xl font-bold">Find a cat</h1>
        <p className="mt-2 text-muted-foreground">
          A little friend. A whole lot of love.
        </p>
        <Suspense
          fallback={
            <p className="py-8" role="status">
              Loading cats…
            </p>
          }
        >
          <CatResults searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
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
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <CatFilters
        key={appliedParams.toString()}
        initialFilters={filters}
        breeds={breeds}
      />
      <section aria-label="Cat results" className="min-w-0">
        <p className="mb-6 text-sm text-muted-foreground">
          Showing {items.length} out of {total} cats · {CATS_PER_PAGE} per page
        </p>
        {items.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((cat) => (
              <Link
                key={cat.id}
                href={`/find_a_cat/${cat.id}`}
                prefetch={false}
                aria-label={`View profile for ${cat.name}`}
                className="group flex flex-col overflow-hidden rounded-[20px] border border-[var(--bilai-line)] bg-[var(--bilai-on-dark)] text-[var(--bilai-ink)] transition-colors hover:border-[var(--bilai-action)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--bilai-focus)]"
              >
                <div className="relative aspect-[32/15] shrink-0 overflow-hidden bg-muted">
                  {cat.coverImageUrl ? (
                    <Image
                      src={cat.coverImageUrl}
                      alt={cat.name}
                      fill
                      unoptimized
                      sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 35vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Cat
                        className="size-12 text-muted-foreground"
                        aria-label="No photo yet"
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h2 className="text-xl leading-tight font-bold tracking-tight [overflow-wrap:anywhere]">
                    {cat.name}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--bilai-muted)]">
                    {cat.breed} · {formatCatAge(cat.ageMonths)} ·{" "}
                    <span className="capitalize">{cat.gender}</span>
                  </p>
                  <div className="mt-auto pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[var(--bilai-line)] pt-4 text-sm">
                      <p className="min-w-0 text-[var(--bilai-muted)] [overflow-wrap:anywhere]">
                        {cat.area}, {cat.district}
                      </p>
                      <span className="inline-flex shrink-0 items-center gap-2 font-bold text-[var(--bilai-action)]">
                        <span className="underline decoration-1 underline-offset-4 group-hover:decoration-2">
                          View profile
                        </span>
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
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
    </div>
  );
}

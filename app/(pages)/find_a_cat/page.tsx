import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Cat, MapPin } from "lucide-react";
import Navbar from "@/components/view/navbar/Navbar";
import Searchbar from "@/components/view/search/Searchbar";
import {
  CATS_PER_PAGE,
  formatCatAge,
  getCats,
} from "@/lib/cats";

type SearchParams = Promise<{ page?: string }>;

export default function FindCatsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <div className="theme-light flex flex-1 flex-col bg-background text-foreground">
      <Navbar />
      <Searchbar />
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

async function CatResults({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const results = await getCats({ page: Number(params.page ?? 1) });
  const { items, total, page, totalPages } = results;
  const href = (target: number) => `/find_a_cat?page=${target}`;
  const pages = Array.from(new Set([1, page - 1, page, page + 1, totalPages]))
    .filter((number) => number > 0 && number <= totalPages)
    .sort((a, b) => a - b);
  const pageClass =
    "flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-border px-3 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <>
      <p className="my-6 text-sm text-muted-foreground">
        Showing {items.length} out of {total} cats · {CATS_PER_PAGE} per page
      </p>
      {items.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((cat) => (
            <Link
              key={cat.id}
              href={`/find_a_cat/${cat.id}`}
              prefetch={false}
              className="overflow-hidden rounded-3xl border border-border bg-card p-2 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary"
            >
              <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-muted">
                {cat.coverImageUrl ? (
                  <Image
                    src={cat.coverImageUrl}
                    alt={cat.name}
                    fill
                    unoptimized
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
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
              <div className="space-y-3 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-xl font-bold">{cat.name}</h2>
                  <span className="text-xs text-muted-foreground">
                    Parent: {cat.owner.name}
                  </span>
                </div>
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-accent px-2.5 py-1 font-medium">
                    {cat.breed}
                  </span>
                  <span>
                    {formatCatAge(cat.ageMonths)} ·{" "}
                    <span className="capitalize">{cat.gender}</span>
                  </span>
                </p>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <p className="flex min-w-0 items-center gap-1 text-muted-foreground">
                    <MapPin className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">
                      {cat.locality}, {cat.city}
                    </span>
                  </p>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold capitalize">
                    {cat.status}
                  </span>
                </div>
                <span className="inline-flex rounded-lg bg-secondary px-3 py-2 text-sm font-bold text-secondary-foreground">
                  Meet {cat.name}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-border bg-card p-10 text-center">
          <h2 className="text-lg font-bold">No cats found</h2>
          <p className="mt-2 text-muted-foreground">
            Check back soon for more cats.
          </p>
          <Link
            href="/find_a_cat"
            className="mt-4 inline-block font-bold underline"
          >
            Back to first page
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
    </>
  );
}

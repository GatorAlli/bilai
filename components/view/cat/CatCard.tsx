import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Cat } from "lucide-react";
import { formatCatAge } from "@/lib/cats";
import { outlineButton } from "@/components/view/styles";
import { cn } from "@/lib/utils";

type CatSummary = {
  id: number;
  name: string;
  area: string | null;
  district: string;
  breed: string;
  ageMonths: number;
  gender: string;
  coverImageUrl: string | null;
};

const catImage =
  "aspect-[1.68] h-auto w-full bg-line object-cover object-[50%_38%]";

// Narrow cards stack identity / facts / profile; past 19rem the facts move
// into a column of their own on the right, spanning both rows.
const catInfo =
  "grid flex-1 grid-cols-1 grid-rows-[auto_auto_1fr] gap-x-4 gap-y-3 p-[clamp(1rem,1.4vw,1.25rem)] wrap-anywhere @min-[19rem]/cat:grid-cols-[minmax(8rem,1.05fr)_minmax(0,1fr)] @min-[19rem]/cat:grid-rows-[auto_1fr]";

export default function CatCard({
  cat,
  sizes,
  nameAs: Name = "h3",
  note,
  imageClassName,
  wholeCardLink = false,
}: {
  cat: CatSummary;
  sizes: string;
  nameAs?: "h2" | "h3";
  // Extra line under the location, e.g. when a listing expires.
  note?: string;
  imageClassName?: string;
  // In a grid of cards, stretch the profile link over the whole card so the
  // card itself is clickable.
  wholeCardLink?: boolean;
}) {
  const age = formatCatAge(cat.ageMonths)
    .replace(/ (\d+) (?=months?\b)/, ", $1 ")
    .replace(/(\d) (?=years?\b|months?\b)/g, "$1\u00a0");
  const facts = [
    ["Breed", cat.breed],
    ["Age", age],
    ["Sex", cat.gender],
  ];

  return (
    <article
      className={cn(
        "@container/cat relative flex min-w-0 flex-col overflow-hidden rounded-[.875rem] border border-line bg-card",
        wholeCardLink &&
          "focus-within:outline-2 focus-within:outline-offset-3 focus-within:outline-focus",
      )}
    >
      {cat.coverImageUrl ? (
        <Image
          className={cn(catImage, imageClassName)}
          src={cat.coverImageUrl}
          alt={cat.name}
          width={672}
          height={400}
          sizes={sizes}
          unoptimized
        />
      ) : (
        <div
          className={cn(
            catImage,
            "grid flex-none place-items-center text-muted-foreground",
            imageClassName,
          )}
          role="img"
          aria-label="No photo yet"
        >
          <Cat size={42} aria-hidden="true" />
        </div>
      )}
      <div className={catInfo}>
        <div className="col-start-1 row-start-1">
          <Name className="font-display text-[clamp(1.25rem,6cqi,1.6rem)] leading-[1.12] font-[660] tracking-[-.025em]">
            {cat.name}
          </Name>
          <p className="mt-1 text-sm text-ink">
            {[cat.area, cat.district].filter(Boolean).join(", ")}
          </p>
          {note ? (
            <p className="mt-1 text-sm font-[650] text-action">{note}</p>
          ) : null}
        </div>
        <dl className="col-start-1 row-start-2 grid gap-[.4rem] self-start text-sm leading-[1.35] @min-[19rem]/cat:col-start-2 @min-[19rem]/cat:row-span-2 @min-[19rem]/cat:row-start-1 @min-[19rem]/cat:w-[min(100%,13.5rem)] @min-[19rem]/cat:justify-self-end">
          {facts.map(([label, value]) => (
            <div
              key={label}
              className="grid grid-cols-[2.3rem_minmax(0,1fr)] items-baseline gap-2"
            >
              <dt className="text-[.8125rem] font-bold text-action">{label}</dt>
              <dd
                className={
                  label === "Sex" ? "font-[550] capitalize" : "font-[550]"
                }
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <Link
          href={`/find_a_cat/${cat.id}`}
          prefetch={false}
          className={cn(
            outlineButton,
            "col-start-1 row-start-3 gap-[.4rem] self-end justify-self-start px-[.65rem] text-sm @min-[19rem]/cat:row-start-2 print:hidden",
            wholeCardLink && "after:absolute after:inset-0 after:content-['']",
          )}
          aria-label={`View profile for ${cat.name}`}
        >
          View profile
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

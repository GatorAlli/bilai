import Link from "next/link";
import { ArrowRight } from "lucide-react";
import CatCard from "@/components/view/cat/CatCard";
import { homeHeading, outlineButton, waveEdge } from "@/components/view/styles";
import { getFeaturedCats } from "@/lib/cats";

export default async function FeaturedCats() {
  const featuredCats = await getFeaturedCats();
  if (featuredCats.length < 3) return null;

  return (
    <section
      id="meet-the-cats"
      // The scalloped edge belongs to the section above this one, so it is cut
      // from this section's own background colour rather than the default ink.
      className={`${waveEdge} bg-on-dark py-section [--bilai-wave-color:var(--bilai-on-dark)]`}
      aria-labelledby="featured-title"
    >
      <div className="frame">
        <div className="mb-4 flex items-end justify-between gap-x-6 gap-y-3 max-sm:flex-col max-sm:items-start">
          <div>
            <h2 id="featured-title" className={homeHeading}>
              Meet the cats
            </h2>
            <p className="mt-2 text-[.9375rem] leading-[1.55] text-ink">
              Get to know a few cats looking for a home.
            </p>
          </div>
          <Link href="/find_a_cat" className={`${outlineButton} print:hidden`}>
            Explore All
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-[.85rem] max-sm:grid-cols-1">
          {featuredCats.map((cat) => (
            <CatCard
              key={cat.id}
              cat={cat}
              sizes="(max-width: 640px) 100vw, 33vw"
              imageClassName="max-h-56"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

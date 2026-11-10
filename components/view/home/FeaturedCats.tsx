import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Cat } from "lucide-react";
import { formatCatAge, getFeaturedCats } from "@/lib/cats";

export default async function FeaturedCats({
  headingClassName,
}: {
  headingClassName: string;
}) {
  const featuredCats = await getFeaturedCats();
  if (featuredCats.length < 3) return null;

  return (
    <section
      id="meet-the-cats"
      className="bilai-featured"
      aria-labelledby="featured-title"
    >
      <div className="bilai-featured-inner">
        <div className="bilai-featured-heading">
          <div>
            <h2 id="featured-title" className={headingClassName}>
              Meet the cats
            </h2>
            <p>Get to know a few cats looking for a home.</p>
          </div>
          <Link href="/find_a_cat" className="bilai-featured-explore">
            Explore All
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>

        <div className="bilai-featured-grid">
          {featuredCats.map((cat) => (
            <article key={cat.id} className="bilai-featured-card">
              {cat.coverImageUrl ? (
                <Image
                  src={cat.coverImageUrl}
                  alt={cat.name}
                  width={672}
                  height={400}
                  unoptimized
                  sizes="(max-width: 640px) 100vw, 33vw"
                />
              ) : (
                <div
                  className="bilai-featured-placeholder"
                  role="img"
                  aria-label="No photo yet"
                >
                  <Cat size={48} aria-hidden="true" />
                </div>
              )}
              <div className="bilai-featured-info">
                <h3>{cat.name}</h3>
                <p>
                  {cat.breed} · {formatCatAge(cat.ageMonths)} ·{" "}
                  <span className="capitalize">{cat.gender}</span>
                </p>
                <div className="bilai-featured-meta">
                  <span>
                    {cat.area}, {cat.district}
                  </span>
                  <Link
                    href={`/find_a_cat/${cat.id}`}
                    prefetch={false}
                    className="bilai-featured-profile"
                    aria-label={`View profile for ${cat.name}`}
                  >
                    <span>View profile</span>
                    <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

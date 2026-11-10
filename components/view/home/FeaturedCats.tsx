import Link from "next/link";
import { ArrowRight } from "lucide-react";
import CatCard from "@/components/view/cat/CatCard";
import { getFeaturedCats } from "@/lib/cats";

export default async function FeaturedCats() {
  const featuredCats = await getFeaturedCats();
  if (featuredCats.length < 3) return null;

  return (
    <section
      id="meet-the-cats"
      className="bilai-featured"
      aria-labelledby="featured-title"
    >
      <div className="bilai-frame">
        <div className="bilai-featured-heading">
          <div>
            <h2 id="featured-title">Meet the cats</h2>
            <p>Get to know a few cats looking for a home.</p>
          </div>
          <Link href="/find_a_cat" className="bilai-outline">
            Explore All
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>

        <div className="bilai-featured-grid">
          {featuredCats.map((cat) => (
            <CatCard key={cat.id} cat={cat} sizes="(max-width: 640px) 100vw, 33vw" />
          ))}
        </div>
      </div>
    </section>
  );
}

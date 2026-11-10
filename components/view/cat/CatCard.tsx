import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Cat } from "lucide-react";
import { formatCatAge } from "@/lib/cats";

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

export default function CatCard({
  cat,
  sizes,
  nameAs: Name = "h3",
}: {
  cat: CatSummary;
  sizes: string;
  nameAs?: "h2" | "h3";
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
    <article className="bilai-cat-card">
      {cat.coverImageUrl ? (
        <Image
          className="bilai-cat-image"
          src={cat.coverImageUrl}
          alt={cat.name}
          width={672}
          height={400}
          sizes={sizes}
          unoptimized
        />
      ) : (
        <div className="bilai-cat-image bilai-cat-placeholder" role="img" aria-label="No photo yet">
          <Cat size={42} aria-hidden="true" />
        </div>
      )}
      <div className="bilai-cat-info">
        <div className="bilai-cat-identity">
          <Name className="bilai-cat-name">{cat.name}</Name>
          <p>{[cat.area, cat.district].filter(Boolean).join(", ")}</p>
        </div>
        <dl className="bilai-cat-facts">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className={label === "Sex" ? "capitalize" : undefined}>{value}</dd>
            </div>
          ))}
        </dl>
        <Link
          href={`/find_a_cat/${cat.id}`}
          prefetch={false}
          className="bilai-outline bilai-cat-profile"
          aria-label={`View profile for ${cat.name}`}
        >
          View profile
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

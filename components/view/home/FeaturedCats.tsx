"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ballu from "@/public/featured-ballu.jpg";
import ernest from "@/public/featured-ernest.jpg";
import boltu from "@/public/featured-boltu.jpg";

const featuredCats = [
  {
    name: "Ballu",
    photo: ballu,
    alt: "Ballu, a ginger tabby, crouching outdoors",
    details: "Deshi · 3 years, 2 months · Male",
    location: "Badda, Dhaka",
    crop: "54% 50%",
  },
  {
    name: "Ernest Hemingway",
    photo: ernest,
    alt: "Ernest Hemingway, a white, black, and orange kitten",
    details: "Persian · 3 months · Female",
    location: "Hazaribagh, Dhaka",
    crop: "50% 24%",
  },
  {
    name: "Boltu",
    photo: boltu,
    alt: "Boltu, a black-and-white cat sitting in the grass",
    details: "Deshi · 2 years, 1 month · Male",
    location: "Dhanmondi, Dhaka",
    crop: "50% 46%",
  },
];

type FeaturedCat = (typeof featuredCats)[number];

export default function FeaturedCats({
  headingClassName,
}: {
  headingClassName: string;
}) {
  const [selected, setSelected] = useState<FeaturedCat | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (selected && element && !element.open) element.showModal();
  }, [selected]);

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
            <p>Get to know a few cats from the Bilai preview.</p>
          </div>
          <Link href="/find_a_cat" className="bilai-featured-explore">
            Explore All
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>

        <div className="bilai-featured-grid">
          {featuredCats.map((cat) => (
            <article key={cat.name} className="bilai-featured-card">
              <Image
                src={cat.photo}
                alt={cat.alt}
                sizes="(max-width: 640px) 100vw, 33vw"
                style={{ objectPosition: cat.crop }}
              />
              <div className="bilai-featured-info">
                <h3>{cat.name}</h3>
                <p>{cat.details}</p>
                <div className="bilai-featured-meta">
                  <span>{cat.location}</span>
                  <button
                    type="button"
                    className="bilai-featured-profile"
                    aria-label={`View profile for ${cat.name}`}
                    aria-haspopup="dialog"
                    onClick={(event) => {
                      opener.current = event.currentTarget;
                      setSelected(cat);
                    }}
                  >
                    <span>View profile</span>
                    <ArrowRight size={17} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <dialog
        ref={dialog}
        className="bilai-featured-dialog"
        aria-labelledby="featured-profile-title"
        onClose={() => {
          setSelected(null);
          opener.current?.focus();
        }}
      >
        {selected && (
          <>
            <div className="bilai-featured-dialog-title">
              <h2 id="featured-profile-title" className={headingClassName}>
                {selected.name}
              </h2>
              <form method="dialog">
                <button type="submit" aria-label="Close profile">
                  <X size={20} aria-hidden="true" />
                </button>
              </form>
            </div>
            <p>{selected.details} · {selected.location}</p>
            <Image
              src={selected.photo}
              alt={selected.alt}
              sizes="(max-width: 540px) 90vw, 460px"
              style={{ objectPosition: selected.crop }}
            />
            <p>This is a sample profile from the Bilai preview.</p>
            <Link href="/find_a_cat" className="bilai-featured-explore">
              Browse the adoption directory
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </>
        )}
      </dialog>
    </section>
  );
}

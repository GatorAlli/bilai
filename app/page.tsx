import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import { ArrowRight } from "lucide-react";
import Navbar from "@/components/view/navbar/Navbar";
import heroPhoto from "@/public/bilai-hero.jpg";
import "./home.css";

const fraunces = localFont({
  src: "./fonts/Fraunces.woff2",
  weight: "500 800",
  display: "swap",
});

export default function Home() {
  return (
    <div className="bilai-home-page">
      <Navbar currentPage="home" />
      <main className="bilai-home-hero" aria-labelledby="home-title">
        <div className="bilai-home-copy">
          <h1 id="home-title" className={fraunces.className}>
            <span>Adopt a cat</span>{" "}
            <span className="bilai-home-accent">close to home.</span>
          </h1>
          <p>
            Browse cats for adoption in Bangladesh. See who’s nearby, get to
            know their story, and find a cat who’ll feel at home with you.
          </p>
          <Link href="/find_a_cat" className="bilai-home-cta">
            Meet the cats
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
        <figure className="bilai-home-photo">
          <Image
            src={heroPhoto}
            alt="Ginger tabby resting on a woven bench in the window light"
            sizes="(max-width: 640px) 100vw, 56vw"
            loading="eager"
            fetchPriority="high"
          />
          <figcaption>
            <strong>There’s room for one more.</strong>
            <span>Adopt with Bilai</span>
          </figcaption>
        </figure>
      </main>
    </div>
  );
}

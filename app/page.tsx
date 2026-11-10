import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import { ArrowRight, ArrowUp } from "lucide-react";
import { Suspense } from "react";
import FeaturedCats from "@/components/view/home/FeaturedCats";
import HomeEffects from "@/components/view/home/HomeEffects";
import Navbar from "@/components/view/navbar/Navbar";
import heroPhoto from "@/public/bilai-doorstep.jpg";
import "./home.css";

const fraunces = localFont({
  src: "./fonts/Fraunces.woff2",
  weight: "500 800",
  display: "swap",
  variable: "--bilai-display",
});

export default function Home() {
  return (
    <div id="home" className={`bilai-home-page ${fraunces.variable}`}>
      <a className="bilai-home-skip" href="#main-content">
        Skip to content
      </a>
      <Navbar currentPage="home" />
      <main id="main-content" tabIndex={-1}>
        <section
          className="bilai-home-hero"
          data-bilai-dark
          aria-labelledby="home-title"
        >
          <Image
            className="bilai-home-photo"
            src={heroPhoto}
            alt="A black-and-white cat resting in a sunlit doorway"
            sizes="100vw"
            loading="eager"
            fetchPriority="high"
          />
          <div className="bilai-home-copy">
            <h1 id="home-title">
              A cat to<br />
              come home to
            </h1>
            <p>
              Browse cats for adoption in Bangladesh and get to know the ones
              near you.
            </p>
            <Link href="/find_a_cat" className="bilai-home-cta">
              Meet the cats
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <Suspense fallback={null}>
          <FeaturedCats />
        </Suspense>

        <div className="bilai-home-end" data-bilai-dark>
          <section id="our-story" aria-labelledby="story-title">
            <h2 id="story-title" data-bilai-reveal>It started with a litter</h2>
            <p>
              One of us needed to find homes for a litter of kittens. In
              Bangladesh, that meant sorting through busy Facebook groups,
              where a cat’s listing could get buried as new posts came in.
            </p>
            <p>
              We built Bilai to give cat parents and adopters one place to start
              a conversation. Bilai’s first version won the{" "}
              <strong>Excellence in Social Impact Award</strong> at AnimalHack
              2026.
            </p>
          </section>
          <section aria-labelledby="rehome-title">
            <h2 id="rehome-title" data-bilai-reveal>
              Finding a home for your cat?
            </h2>
            <p>
              Share a recent photo and a few details about life with your cat
              so adopters can get to know them.
            </p>
            <Link href="/add_a_cat" className="bilai-home-cta">
              List a cat
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </section>
        </div>
      </main>

      <footer className="bilai-home-footer" data-bilai-dark>
        <div className="bilai-home-footer-inner">
          <Link href="/" className="bilai-nav-brand" aria-label="Bilai home">
            <Image src="/logo.png" width={40} height={40} alt="" />
            <span>bilai.</span>
          </Link>
          <a href="#home" className="bilai-home-back">
            Back to top
            <ArrowUp size={18} aria-hidden="true" />
          </a>
        </div>
      </footer>
      <HomeEffects />
    </div>
  );
}

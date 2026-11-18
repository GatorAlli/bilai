import Image from "next/image";
import Link from "next/link";
import BilaiPage from "@/components/view/BilaiPage";
import { ArrowRight } from "lucide-react";
import { Suspense } from "react";
import FeaturedCats from "@/components/view/home/FeaturedCats";
import HomeEffects from "@/components/view/home/HomeEffects";
import { homeHeading, waveEdge } from "@/components/view/styles";
import heroPhoto from "@/public/bilai-doorstep.jpg";

// The green call to action. Height and horizontal padding are set per use, so
// the hero's larger button never has to out-rank a value from this string.
const homeCta =
  "inline-flex items-center justify-center gap-[.55rem] rounded-[.65rem] border border-transparent bg-green py-[.65rem] text-[.9375rem] leading-[1.3] font-bold text-ink *:shrink-0 hover:bg-green-hover active:bg-green-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper forced-colors:border-[color:ButtonText] print:hidden";

const endCopy = "mt-3 text-[.9375rem] leading-[1.6]";

// Revealed by HomeEffects once the heading scrolls into view.
const revealed = `${homeHeading} text-balance motion-safe:data-[bilai-revealed]:animate-arrive`;

export default function Home() {
  return (
    <BilaiPage currentPage="home">
      <section
        className="relative isolate grid min-h-[clamp(30rem,min(54vw,calc(81svh-4.25rem)),42rem)] items-center bg-ink pt-[clamp(3rem,7vw,6rem)] pb-[clamp(2rem,4vw,3.5rem)] text-paper after:pointer-events-none after:absolute after:inset-0 after:bg-(image:--bilai-hero-veil) after:content-[''] max-sm:min-h-[33.75rem] max-sm:items-end max-sm:pt-64 max-sm:pb-5 max-sm:after:bg-(image:--bilai-hero-veil-narrow) print:block print:min-h-0 print:bg-transparent print:py-4 print:text-black print:after:hidden forced-colors:after:hidden"
        data-bilai-dark
        aria-labelledby="home-title"
      >
        <Image
          className="absolute inset-0 size-full object-cover object-[39%_50%] max-sm:h-[65%] max-sm:object-[54%_50%] print:hidden forced-colors:hidden"
          src={heroPhoto}
          alt="A black-and-white cat resting in a sunlit doorway"
          sizes="100vw"
          loading="eager"
          fetchPriority="high"
        />
        {/* A container at narrow widths, so the title can size itself in cqi. */}
        <div className="relative z-1 w-full px-gutter max-sm:@container">
          <h1
            id="home-title"
            className="font-display text-[clamp(3.35rem,8vw,8rem)] leading-[.94] font-[760] tracking-[-.035em] uppercase [word-spacing:.065em] motion-safe:animate-arrive max-sm:text-[clamp(1.65rem,11.8cqi,4.25rem)]"
          >
            A cat to
            <br />
            come home to
          </h1>
          <p className="mt-6 max-w-[37ch] text-[clamp(1rem,1.55vw,1.25rem)] leading-[1.6] max-sm:mt-4">
            Browse cats for adoption in Bangladesh and get to know the ones near
            you.
          </p>
          <Link
            href="/find_a_cat"
            className={`${homeCta} mt-6 min-h-12 px-5 max-sm:mt-4`}
          >
            Meet the cats
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <Suspense fallback={null}>
        <FeaturedCats />
      </Suspense>

      <div
        className={`${waveEdge} grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] items-start gap-x-[clamp(2rem,5vw,4rem)] gap-y-section bg-ink px-gutter pt-[calc(var(--bilai-section-space)+.5rem)] pb-[calc(var(--bilai-section-space)-.5rem)] text-paper max-sm:grid-cols-1 print:bg-transparent print:text-black`}
        data-bilai-dark
      >
        <section id="our-story" aria-labelledby="story-title">
          <h2 id="story-title" className={revealed} data-bilai-reveal>
            It started with a litter
          </h2>
          <p className={`${endCopy} max-w-[67ch]`}>
            One of us needed to find homes for a litter of kittens. In
            Bangladesh, that meant sorting through busy Facebook groups, where a
            cat’s listing could get buried as new posts came in.
          </p>
          <p className={`${endCopy} max-w-[67ch]`}>
            We built Bilai to give cat parents and adopters one place to start a
            conversation.
          </p>
          <p className="mt-4 flex max-w-[67ch] flex-wrap items-baseline gap-x-4 gap-y-1 text-[.9375rem] leading-[1.6]">
            <span className="sr-only">Bilai’s first version won the </span>
            <strong className="font-[750] text-green">
              Excellence in Social Impact Award
            </strong>
            <span className="sr-only"> at </span>
            <span className="font-display text-xl font-bold tracking-[-.015em] whitespace-nowrap">
              Animal Hack 2026
            </span>
          </p>
        </section>
        <section aria-labelledby="rehome-title">
          <h2 id="rehome-title" className={revealed} data-bilai-reveal>
            Finding a home for your cat?
          </h2>
          <p className={`${endCopy} max-w-[46ch]`}>
            Share a recent photo and a few details about life with your cat so
            adopters can get to know them.
          </p>
          <Link href="/add_a_cat" className={`${homeCta} mt-4 min-h-11 px-4`}>
            List a cat
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </section>
      </div>
      <HomeEffects />
    </BilaiPage>
  );
}

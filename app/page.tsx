import Image from "next/image";
import Link from "next/link";
import BilaiPage from "@/components/view/BilaiPage";
import { ArrowRight } from "lucide-react";
import { Suspense } from "react";
import FeaturedCats from "@/components/view/home/FeaturedCats";
import { homeCta } from "@/components/view/styles";
import heroPhoto from "@/public/bilai-doorstep.jpg";

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
    </BilaiPage>
  );
}

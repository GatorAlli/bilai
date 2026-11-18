import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PawIcon from "./PawIcon";
import { homeCta, homeHeading, waveEdge } from "./styles";
import { cn } from "@/lib/utils";

const footerLink =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper";

// Revealed by ScrollEffects once the heading scrolls into view.
const revealed = `${homeHeading} text-balance motion-safe:data-[bilai-revealed]:animate-arrive`;

const endCopy = "mt-3 text-[.9375rem] leading-[1.6]";

export default function Footer({ topId }: { topId: string }) {
  return (
    <footer
      className="relative bg-ink text-paper print:bg-transparent print:text-black"
      data-bilai-dark
    >
      <div
        className={cn(
          waveEdge,
          "grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] items-start gap-x-[clamp(2rem,5vw,4rem)] gap-y-section px-gutter pt-[calc(var(--bilai-section-space)+.5rem)] pb-[calc(var(--bilai-section-space)-.5rem)] max-sm:grid-cols-1",
        )}
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
      <div className="frame flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
        <Link
          href="/"
          className={cn(
            "inline-flex min-h-11 items-center gap-[.4rem] font-brand text-2xl leading-none",
            footerLink,
          )}
          aria-label="Bilai home"
        >
          <Image
            src="/logo.png"
            width={40}
            height={40}
            alt=""
            className="size-[2.45rem] mix-blend-normal [clip-path:circle(38.4%)]"
          />
          <span>bilai.</span>
        </Link>
        <a
          href={`#${topId}`}
          className={cn(
            "grid size-11 flex-none place-items-center rounded-full border border-current/40 text-inherit print:hidden",
            "hover:bg-current/13 active:bg-current/13",
            footerLink,
          )}
          aria-label="Back to top"
          title="Back to top"
        >
          <PawIcon size={20} />
        </a>
      </div>
    </footer>
  );
}

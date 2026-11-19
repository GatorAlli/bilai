import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import BilaiPage from "@/components/view/BilaiPage";
import CatDoodle, {
  type CatDoodleName,
} from "@/components/view/doodles/CatDoodle";
import DoodleDrift from "@/components/view/doodles/DoodleDrift";
import { homeCta, homeHeading } from "@/components/view/styles";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Page not found" };

// The same pencilled cats as the login page, drifting around a 3x3 grid whose
// middle column stays clear for the message. Blaze orange is kept to the yarn
// and the fish, the page's only accent.
const doodle =
  "grid place-items-center overflow-hidden text-action opacity-[.48]";
const accent = "text-blaze opacity-[.7]";
const bigDoodle =
  "h-auto w-[clamp(3.5rem,7.5vw,6.5rem)] max-[44rem]:w-[3.1rem]";
const smallDoodle =
  "h-auto w-[clamp(2.5rem,5.8vw,4.75rem)] max-[44rem]:w-[3.1rem]";

const doodles: Array<{
  name: CatDoodleName;
  className: string;
  iconClassName: string;
}> = [
  {
    name: "play",
    className: "col-start-1 row-start-1",
    iconClassName: bigDoodle,
  },
  {
    name: "rest",
    className: "col-start-3 row-start-1 max-[44rem]:col-start-2",
    iconClassName: bigDoodle,
  },
  {
    name: "walk",
    className: "col-start-1 row-start-2 max-[44rem]:hidden",
    iconClassName: bigDoodle,
  },
  {
    name: "peek",
    className: "col-start-3 row-start-2 max-[44rem]:hidden",
    iconClassName: bigDoodle,
  },
  {
    name: "fish",
    className: cn("col-start-1 row-start-3", accent),
    iconClassName: smallDoodle,
  },
  {
    name: "yarn",
    className: cn("col-start-3 row-start-3 max-[44rem]:col-start-2", accent),
    iconClassName: smallDoodle,
  },
];

export default function NotFound() {
  return (
    <BilaiPage
      currentPage="none"
      mainClassName="frame relative isolate flex flex-col items-center justify-center py-section text-center max-[44rem]:py-24"
    >
      <DoodleDrift className="pointer-events-none absolute inset-0 -z-1 grid grid-cols-[minmax(0,1fr)_minmax(29rem,42%)_minmax(0,1fr)] grid-rows-3 px-gutter py-[clamp(.75rem,2vw,1.75rem)] max-[44rem]:grid-cols-2 max-[44rem]:grid-rows-[4.75rem_minmax(0,1fr)_4.75rem] max-[44rem]:p-0 print:hidden">
        {doodles.map(({ name, className, iconClassName }) => (
          <span key={name} data-doodle className={cn(doodle, className)}>
            <CatDoodle name={name} className={iconClassName} />
          </span>
        ))}
      </DoodleDrift>

      <p className="font-display text-[clamp(6rem,20vw,12rem)] leading-[.9] font-[800] tracking-[-.04em] select-none">
        404
      </p>

      <h1 className={cn(homeHeading, "mt-5 text-balance")}>
        This page wandered off
      </h1>
      <p className="mt-3 max-w-[44ch] leading-[1.6] text-pretty text-muted-foreground">
        Like most cats, it didn’t leave a note. The link may be old, or the
        listing may have found a home and expired.
      </p>

      <Link href="/find_a_cat" className={cn(homeCta, "mt-7 min-h-12 px-5")}>
        Meet the cats
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </BilaiPage>
  );
}

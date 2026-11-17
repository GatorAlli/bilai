import type { ComponentProps, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import PawIcon from "./PawIcon";
import Navbar from "./navbar/Navbar";
import { waveEdge } from "./styles";
import { cn } from "@/lib/utils";

const fraunces = localFont({
  src: "../../app/fonts/Fraunces.woff2",
  weight: "500 800",
  display: "swap",
  variable: "--bilai-display",
});

const footerLink =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper";

export default function BilaiPage({
  currentPage,
  mainClassName,
  children,
}: {
  currentPage: ComponentProps<typeof Navbar>["currentPage"];
  mainClassName?: string;
  children: ReactNode;
}) {
  const isHome = currentPage === "home";
  const top = isHome ? "home" : "page-top";

  return (
    <div
      id={top}
      // `bilai-theme` carries the palette; `bilai-site` is the hook the
      // document-level rules in globals.css match on.
      className={cn(
        "bilai-theme bilai-site flex min-w-0 flex-1 flex-col bg-background text-foreground",
        fraunces.variable,
      )}
      data-bilai-home={isHome ? "" : undefined}
    >
      <a
        className={cn(
          "fixed top-2 left-3 z-10 -translate-y-[200%] rounded-[.65rem] bg-paper px-4 py-[.65rem] print:hidden",
          "focus:translate-none focus:outline-2 focus:outline-offset-4 focus:outline-focus",
        )}
        href="#main-content"
      >
        Skip to content
      </a>
      <Navbar currentPage={currentPage} />
      <main
        id="main-content"
        className={cn("min-w-0 flex-1", mainClassName)}
        tabIndex={-1}
      >
        {children}
      </main>
      {/* On the homepage the scalloped edges sit on the sections themselves,
          so the footer only grows one on the other pages. */}
      <footer
        className={cn(
          "relative bg-ink text-paper print:bg-transparent print:text-black",
          !isHome && waveEdge,
        )}
        data-bilai-dark
      >
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
            href={`#${top}`}
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
    </div>
  );
}

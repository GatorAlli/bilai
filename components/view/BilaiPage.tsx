import type { ComponentProps, ReactNode } from "react";
import localFont from "next/font/local";
import Navbar from "./navbar/Navbar";
import Footer from "./Footer";
import ScrollEffects from "./ScrollEffects";
import { cn } from "@/lib/utils";

const fraunces = localFont({
  src: "../../app/fonts/Fraunces.woff2",
  weight: "500 800",
  display: "swap",
  variable: "--bilai-display",
});

export default function BilaiPage({
  currentPage,
  mainClassName,
  children,
}: {
  currentPage: ComponentProps<typeof Navbar>["currentPage"];
  mainClassName?: string;
  children: ReactNode;
}) {
  const top = currentPage === "home" ? "home" : "page-top";

  return (
    <div
      id={top}
      // `bilai-theme` carries the palette; `bilai-site` is the hook the
      // document-level rules in globals.css match on.
      className={cn(
        "bilai-theme bilai-site flex min-w-0 flex-1 flex-col bg-background text-foreground",
        fraunces.variable,
      )}
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
      <Footer topId={top} />
      <ScrollEffects />
    </div>
  );
}

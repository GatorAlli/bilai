/* Tailwind class strings shared by more than one bilai page or component.
   Kept as whole strings so Tailwind can still find them when it scans the
   source — never build one by interpolating fragments. */

/** Quiet bordered button: "Explore All", "View profile", "Back to Find a Cat". */
export const outlineButton =
  "inline-flex min-h-11 items-center justify-center gap-[.55rem] rounded-[.65rem] border border-control-line px-4 py-[.65rem] text-[.9375rem] font-bold leading-[1.3] *:shrink-0 hover:bg-active active:bg-active focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus";

/** Scalloped edge along the top of a section, cut from --bilai-wave-color.
    Set [--bilai-wave-color:…] on the element to match the section above it. */
export const waveEdge =
  "relative [--bilai-wave-color:var(--bilai-ink)] before:pointer-events-none before:absolute before:inset-x-0 before:bottom-[calc(100%-1px)] before:z-1 before:h-7 before:origin-bottom before:bg-(color:--bilai-wave-color) before:[mask:var(--bilai-wave-mask)] before:content-[''] motion-safe:before:animate-wave print:before:hidden";

/** Page title and the line of copy under it. */
export const headingTitle =
  "text-[clamp(2.25rem,4.3vw,3.75rem)] font-extrabold leading-[1.03] tracking-[-.045em] wrap-anywhere";
export const headingText =
  "mt-2 max-w-[37rem] leading-[1.6] text-muted-foreground";

/** Section headings on the homepage, in the display face. */
export const homeHeading =
  "font-display text-[clamp(1.8rem,3.1vw,2.75rem)] font-[660] leading-[1.08] tracking-[-.038em]";

/** The green call to action: hero "Meet the cats" and the footer's "List a
    cat". Height and horizontal padding are set per use, so the hero's larger
    button never has to out-rank a value from this string. */
export const homeCta =
  "inline-flex items-center justify-center gap-[.55rem] rounded-[.65rem] border border-transparent bg-green py-[.65rem] text-[.9375rem] leading-[1.3] font-bold text-ink *:shrink-0 hover:bg-green-hover active:bg-green-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper forced-colors:border-[color:ButtonText] print:hidden";

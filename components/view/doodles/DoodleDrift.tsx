"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Sets each drawing inside a `[data-doodle]` zone wandering slowly around
// that zone: a random spot and tilt, eased over 7.6–15.4s, then the next.
// Stops entirely while the visitor prefers reduced motion.

function startDrift(zone: HTMLElement) {
  const icon = zone.querySelector("svg");
  if (!icon) return;

  let position = { x: 0, y: 0, tilt: 0 };
  let animation: Animation;
  const between = (min: number, max: number) =>
    min + Math.random() * (max - min);

  const next = () => {
    const horizontalRoom = Math.max(
      0,
      (zone.clientWidth - icon.clientWidth) / 2 - 10,
    );
    const verticalRoom = Math.max(
      0,
      (zone.clientHeight - icon.clientHeight) / 2 - 10,
    );
    const destination = {
      x: between(-horizontalRoom, horizontalRoom),
      y: between(-verticalRoom, verticalRoom),
      tilt: between(-13, 13),
    };

    animation?.cancel();
    animation = icon.animate(
      [position, destination].map(({ x, y, tilt }) => ({
        transform: `translate(${x}px, ${y}px) rotate(${tilt}deg)`,
      })),
      {
        duration: between(7600, 15400),
        easing: "ease-in-out",
        fill: "forwards",
      },
    );
    position = destination;
    animation.onfinish = next;
  };

  next();
  return () => {
    animation.onfinish = null;
    animation.cancel();
  };
}

/** Decorative layer whose `[data-doodle]` children drift. Hidden from
    assistive tech and from print. */
export default function DoodleDrift({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const artRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const art = artRef.current;
    if (!art) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const zones = [...art.querySelectorAll<HTMLElement>("[data-doodle]")];
    let stopAnimations: Array<ReturnType<typeof startDrift>> = [];
    const stop = () =>
      stopAnimations.forEach((stopAnimation) => stopAnimation?.());

    const syncMotion = () => {
      stop();
      stopAnimations = preference.matches ? [] : zones.map(startDrift);
    };

    syncMotion();
    preference.addEventListener("change", syncMotion);
    return () => {
      stop();
      preference.removeEventListener("change", syncMotion);
    };
  }, []);

  return (
    <div ref={artRef} className={className} aria-hidden="true">
      {children}
    </div>
  );
}

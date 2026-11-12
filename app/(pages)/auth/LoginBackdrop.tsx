"use client";

import { useEffect, useRef } from "react";

const doodles = [
  {
    name: "rest",
    lines: (
      <>
        <path d="M19 38c0-9 2-18 5-24l8 6a38 38 0 0 1 19 0l8-6c4 8 6 17 6 25 0 15-11 24-24 24S19 54 19 38Z" />
        <path d="M65 31c14 2 23 13 23 27 0 13-8 22-22 23H31c-9 0-14-5-14-11 0-5 3-8 8-11m23 22c-2-8 5-13 13-14 8-1 12-5 12-10m13 9c9-1 10-14 4-23" />
        <path d="M28 39q3 3 7 0m13 0q4 3 7 0m-17 8q3-3 6 0l-3 3-3-3Zm3 3q-1 6-6 4m6-4q1 6 6 4M20 47l9 2m35-2-10 2" />
      </>
    ),
  },
  {
    name: "walk",
    lines: (
      <>
        <path d="M9 42c0-9 3-18 7-25l7 7h18l7-7c5 8 7 17 7 26 0 13-10 21-23 21S9 56 9 42Z" />
        <path d="M55 40c14-3 27 3 30 14 4 10 2 22-1 26-3 3-8 2-9-2l-1-8c-6 3-11 4-18 3l-1 6c-1 5-8 5-10 1l-2-16m-14 0-1 13c-1 7-11 7-11 1V61m66-11c8-8 10-18 7-27-1-4-4-6-7-4-2 1-2 4-1 6 2 7 0 14-4 19" />
        <path d="M19 43h4m17 0h4m-15 6q3-3 6 0l-3 3-3-3Zm3 3q0 5-5 5m5-5q0 5 5 5M11 49l8 2m34-2-8 2" />
      </>
    ),
  },
  {
    name: "peek",
    lines: (
      <>
        <path d="M20 46c0-12 2-23 7-32l10 10a45 45 0 0 1 25 0l10-10c5 9 7 20 7 32 0 17-12 26-29 26S20 63 20 46Z" />
        <path d="M31 69v11c0 7 10 8 11 1l1-4h14l1 4c1 7 11 6 11-1V69M36 45h4m19 0h4m-17 7q4-3 8 0l-4 4-4-4Zm4 4q-1 6-7 5m7-5q1 6 7 5M21 52l10 2m47-2-10 2" />
      </>
    ),
  },
  {
    name: "play",
    lines: (
      <>
        <circle cx="22" cy="22" r="9" />
        <path d="M19 21q1-3 4-3m12 18 2-14 10 6 12-2 8-9c4 9 5 17 3 25 11 8 15 21 10 31-4 8-13 11-22 8-13-4-20-16-24-28-5-3-11-8-10-12 1-4 7-4 11-1v-4Zm42 41c5 6 12 4 14-2m-35 5c-9 1-14-4-11-9m-7-21c4 4 8 5 13 5m8 11c3-3 6-3 10-2M44 38h3m12-2h3m-12 8 4 2 3-3m-3 3q1 4-3 5" />
      </>
    ),
  },
  {
    name: "yarn",
    lines: (
      <>
        <circle cx="46" cy="47" r="30" />
        <path d="M18 38q15-16 36-13M17 53q17-18 36-18m-32 29q13-17 28-18m-19 26q27-20 23-54m-4 34q13-15 15-29m-6 38q12-12 14-30M34 62q15 10 28 11M44 54q13 11 24 12m-3 5c10 2 17-5 23-2 4 2 3 6-2 7-5 0-10 5-22 6" />
      </>
    ),
  },
  {
    name: "fish",
    lines: (
      <>
        <path d="M21 49c4-10 15-16 30-16 10 0 19 3 25 9l12-7v20l-12-7c-6 6-15 10-25 10-15 0-26-5-30-9Z" />
        <path d="M34 39q5 6 2 14m11-13 10 12m1-12 10 9m-8-9-10 12m20-11-9 10M21 48c-6 4-8 8-5 13 5 9 23 14 39 14 16 0 33-5 36-14 1-3 0-6-3-8" />
      </>
    ),
  },
];

function startDrift(zone: HTMLSpanElement) {
  const icon = zone.querySelector("svg");
  if (!icon) return;

  let position = { x: 0, y: 0, tilt: 0 };
  let animation: Animation;
  const between = (min: number, max: number) => min + Math.random() * (max - min);

  const next = () => {
    const horizontalRoom = Math.max(0, (zone.clientWidth - icon.clientWidth) / 2 - 10);
    const verticalRoom = Math.max(0, (zone.clientHeight - icon.clientHeight) / 2 - 10);
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
      { duration: between(7600, 15400), easing: "ease-in-out", fill: "forwards" },
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

export default function LoginBackdrop() {
  const artRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const art = artRef.current;
    if (!art) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const zones = [...art.querySelectorAll<HTMLSpanElement>(".bilai-auth-doodle")];
    let stopAnimations: Array<ReturnType<typeof startDrift>> = [];
    const stop = () => stopAnimations.forEach((stopAnimation) => stopAnimation?.());

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
    <div ref={artRef} className="bilai-auth-art" aria-hidden="true">
      {doodles.map(({ name, lines }) => (
        <span key={name} className={`bilai-auth-doodle bilai-auth-doodle--${name}`}>
          <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" focusable="false">
            {lines}
          </svg>
        </span>
      ))}
    </div>
  );
}

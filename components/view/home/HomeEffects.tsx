"use client";

import { useEffect } from "react";

export default function HomeEffects() {
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;

    const home = document.querySelector(".bilai-home-page");
    if (!home) return;

    const root = document.documentElement;
    const visibleDarkSections = new Set<Element>();
    const darkSections = new IntersectionObserver((entries) => {
      for (const { target, isIntersecting } of entries) {
        if (isIntersecting) visibleDarkSections.add(target);
        else visibleDarkSections.delete(target);
      }
      root.toggleAttribute("data-bilai-dark-edge", visibleDarkSections.size > 0);
    });
    for (const section of home.querySelectorAll("[data-bilai-dark]")) {
      darkSections.observe(section);
    }

    const headings = new IntersectionObserver((entries, observer) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        target.setAttribute("data-bilai-revealed", "");
        observer.unobserve(target);
      }
    }, { rootMargin: "0px 0px -56px 0px", threshold: 0.4 });
    for (const heading of home.querySelectorAll("[data-bilai-reveal]")) {
      headings.observe(heading);
    }

    return () => {
      darkSections.disconnect();
      headings.disconnect();
      root.removeAttribute("data-bilai-dark-edge");
    };
  }, []);

  return null;
}

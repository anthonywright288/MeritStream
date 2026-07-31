"use client";

import { useEffect } from "react";

/**
 * Arms the appear-on-scroll system: adds `js` to <html> (so CSS may hide
 * not-yet-seen elements — without JS nothing is ever hidden), then flags each
 * reveal element with `in-view` the first time it enters the viewport. The
 * actual animations are pure CSS keyed off `.in-view`. Renders nothing.
 */
export function AppearObserver() {
  useEffect(() => {
    document.documentElement.classList.add("js");
    const els = document.querySelectorAll(
      ".reveal, .reveal-left, .reveal-right, .reveal-scale, .reveal-float"
    );
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in-view");
            io.unobserve(e.target);
          }
        }
      },
      // fire slightly before fully in view so the motion reads as an entrance
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}

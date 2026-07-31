import * as React from "react";

/**
 * IntersectionObserver-based reveal. Attach the returned ref to an element that
 * already carries the `.reveal` class; once it scrolls into view the `.reveal-in`
 * class is added (compositor-friendly opacity/transform transition defined in CSS).
 *
 * No-ops (reveals immediately) when reduced motion is preferred or IO is missing.
 */
export function useInViewReveal<T extends HTMLElement = HTMLDivElement>(
  options?: { threshold?: number; rootMargin?: string; once?: boolean }
) {
  const ref = React.useRef<T | null>(null);
  const { threshold = 0.12, rootMargin = "0px 0px -10% 0px", once = true } = options || {};

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced || typeof IntersectionObserver === "undefined") {
      el.classList.add("reveal-in");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-in");
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            entry.target.classList.remove("reveal-in");
          }
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return ref;
}

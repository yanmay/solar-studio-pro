import { useLayoutEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function useGsapReveal<T extends HTMLElement>(ref: RefObject<T>) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        root.querySelectorAll<HTMLElement>("[data-reveal]"),
        { y: 28, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: { trigger: root, start: "top 82%", once: true },
        },
      );
    }, root);
    return () => ctx.revert();
  }, [ref]);
}

export function useGsapStack<T extends HTMLElement>(ref: RefObject<T>) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const ctx = gsap.context(() => {
      const cards = root.querySelectorAll<HTMLElement>("[data-stack-card]");
      cards.forEach((card, index) => {
        gsap.to(card, {
          y: index * -10,
          scale: 1 - index * 0.018,
          scrollTrigger: {
            trigger: card,
            start: "top 78%",
            end: "bottom 25%",
            scrub: 0.6,
          },
        });
      });
    }, root);
    return () => ctx.revert();
  }, [ref]);
}

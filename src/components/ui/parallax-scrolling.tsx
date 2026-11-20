import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "@studio-freight/lenis";

export function ParallaxComponent() {
  const parallaxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const root = parallaxRef.current;
    const trigger = root?.querySelector<HTMLElement>("[data-parallax-layers]");
    if (!root || !trigger) return;

    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });

      [
        ["1", 24],
        ["2", 17],
        ["3", 11],
        ["4", 5],
      ].forEach(([layer, yPercent], index) => {
        timeline.to(
          trigger.querySelectorAll(`[data-parallax-layer="${layer}"]`),
          { yPercent, ease: "none" },
          index === 0 ? undefined : "<",
        );
      });
    }, root);

    const lenis = new Lenis({ autoRaf: false });
    const onScroll = () => ScrollTrigger.update();
    const onTick = (time: number) => lenis.raf(time * 1000);
    lenis.on("scroll", onScroll);
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(onTick);
      lenis.off("scroll", onScroll);
      lenis.destroy();
      context.revert();
    };
  }, []);

  return (
    <section ref={parallaxRef} className="parallax-band" aria-labelledby="parallax-title">
      <div className="parallax-band__visuals">
        <div data-parallax-layers className="parallax-band__layers" aria-hidden="true">
          <div data-parallax-layer="1" className="parallax-band__layer parallax-band__layer--terrain" />
          <div data-parallax-layer="2" className="parallax-band__layer parallax-band__layer--haze" />
          <div data-parallax-layer="3" className="parallax-band__layer-title">
            <p className="parallax-band__eyebrow">AI Rooftop Analysis</p>
            <h2 id="parallax-title" className="parallax-band__title">Read the roof.<br /><em>See the yield.</em></h2>
          </div>
          <div data-parallax-layer="4" className="parallax-band__layer parallax-band__layer--grid" />
        </div>
        <div className="parallax-band__vignette" />
      </div>
      <div className="parallax-band__content">
        <span className="parallax-band__rule" />
        <p>Satellite geometry, irradiance and tariff intelligence in one continuous view.</p>
        <span className="parallax-band__index">SUNPOWER LINK / SOLARNET AI</span>
      </div>
    </section>
  );
}


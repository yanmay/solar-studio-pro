import createGlobe, { type COBEOptions } from "cobe";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const DEFAULT_MARKERS: COBEOptions["markers"] = [
  { location: [20.5937, 78.9629], size: 0.08 },
  { location: [19.076, 72.8777], size: 0.1 },
  { location: [12.9716, 77.5946], size: 0.06 },
  { location: [28.6139, 77.209], size: 0.07 },
  { location: [23.8103, 90.4125], size: 0.05 },
  { location: [14.5995, 120.9842], size: 0.03 },
  { location: [40.7128, -74.006], size: 0.06 },
  { location: [34.6937, 135.5022], size: 0.05 },
  { location: [-23.5505, -46.6333], size: 0.06 },
];

const GLOBE_CONFIG: COBEOptions = {
  width: 800,
  height: 800,
  devicePixelRatio: 2,
  phi: 0.25,
  theta: 0.3,
  dark: 0.16,
  diffuse: 0.68,
  mapSamples: 16000,
  mapBrightness: 2.1,
  baseColor: [0.12, 0.18, 0.23],
  markerColor: [1, 0.4, 0.05],
  glowColor: [0.12, 0.025, 0.008],
  markers: DEFAULT_MARKERS,
};

export function Globe({
  className,
  config = GLOBE_CONFIG,
  onZoomIn,
}: {
  className?: string;
  config?: COBEOptions;
  onZoomIn?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phiRef = useRef(config.phi ?? 0);
  const widthRef = useRef(0);
  const dragStartRef = useRef<{ x: number; phi: number } | null>(null);

  useEffect(() => {
    phiRef.current = config.phi ?? 0;
  }, [config.phi]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      widthRef.current = canvas.offsetWidth;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const globe = createGlobe(canvas, {
      ...config,
      width: Math.max(widthRef.current, 1),
      height: Math.max(widthRef.current, 1),
    });
    canvas.style.opacity = "1";

    let animationFrame = 0;
    let previousTime = performance.now();
    const render = (time: number) => {
      const elapsed = Math.min(time - previousTime, 64);
      previousTime = time;

      if (dragStartRef.current === null) {
        phiRef.current += elapsed * 0.000108;
      }

      const size = Math.max(widthRef.current, 1);
      globe.update({
        phi: phiRef.current,
        width: size,
        height: size,
      });
      animationFrame = requestAnimationFrame(render);
    };
    animationFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      globe.destroy();
    };
  }, [config]);

  return (
    <div className={cn("absolute inset-0 mx-auto aspect-square w-full max-w-[680px]", className)}>
      <canvas
        ref={canvasRef}
        className="size-full cursor-grab opacity-0 transition-opacity duration-700 [contain:layout_paint_size] active:cursor-grabbing"
        onPointerDown={(event) => {
          dragStartRef.current = { x: event.clientX, phi: phiRef.current };
          canvasRef.current?.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const dragStart = dragStartRef.current;
          if (dragStart) {
            phiRef.current = dragStart.phi + (event.clientX - dragStart.x) / 200;
          }
        }}
        onPointerUp={(event) => {
          dragStartRef.current = null;
          if (canvasRef.current?.hasPointerCapture(event.pointerId)) {
            canvasRef.current.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => { dragStartRef.current = null; }}
        onLostPointerCapture={() => { dragStartRef.current = null; }}
        onWheel={(event) => {
          if (event.deltaY > 0) onZoomIn?.();
        }}
        aria-label="Interactive solar intelligence globe. Scroll to enter the rooftop map."
        role="img"
      />
    </div>
  );
}

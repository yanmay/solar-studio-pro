import { cn } from "@/lib/utils";

/**
 * FlowAurora — Wispr-flow inspired ambient background. Three slow, drifting,
 * heavily-blurred color fields (amber / violet / teal) on a near-black canvas.
 * Pure CSS animation (compositor-friendly, respects prefers-reduced-motion).
 * Place as the first child of a `relative` container.
 */
export function FlowAurora({ className }: { className?: string }) {
  return (
    <div className={cn("wispr-aurora", className)} aria-hidden="true">
      <span className="blob-a" />
      <span className="blob-b" />
      <span className="blob-c" />
    </div>
  );
}

export default FlowAurora;

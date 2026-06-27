import React, { type ComponentPropsWithoutRef, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * ShimmerButton — a button with light shimmering around its perimeter.
 * Adapted from Magic UI to Tailwind v3: container-query units are enabled via
 * an inline `container-type: size` (CSS containment is baseline in modern
 * browsers), and the shimmer/spin keyframes are registered in tailwind.config.
 */
export interface ShimmerButtonProps extends ComponentPropsWithoutRef<"button"> {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
  className?: string;
  children?: React.ReactNode;
}

export const ShimmerButton = React.forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      shimmerColor = "#FFB87B",
      shimmerSize = "0.05em",
      shimmerDuration = "3s",
      borderRadius = "12px",
      background = "rgba(10,10,12,1)",
      className,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        style={
          {
            "--spread": "90deg",
            "--shimmer-color": shimmerColor,
            "--radius": borderRadius,
            "--speed": shimmerDuration,
            "--cut": shimmerSize,
            "--bg": background,
            borderRadius,
            background,
          } as CSSProperties
        }
        className={cn(
          "group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap border border-white/10 px-6 py-3 font-semibold text-white",
          "transform-gpu transition-transform duration-300 ease-in-out active:translate-y-px",
          className,
        )}
        ref={ref}
        {...props}
      >
        {/* spark container (container-query context for the cqw/cqh units) */}
        <div
          className="-z-30 blur-[2px] absolute inset-0 overflow-visible"
          style={{ containerType: "size" } as CSSProperties}
        >
          <div className="animate-shimmer-slide absolute inset-0 aspect-square h-[100cqh] [mask:none]">
            <div className="animate-spin-around absolute -inset-full w-auto rotate-0 [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))]" />
          </div>
        </div>

        {children}

        {/* Highlight */}
        <div className="absolute inset-0 size-full transform-gpu rounded-[inherit] shadow-[inset_0_-8px_10px_#ffffff1f] transition-all duration-300 ease-in-out group-hover:shadow-[inset_0_-6px_10px_#ffffff3f] group-active:shadow-[inset_0_-10px_10px_#ffffff3f]" />

        {/* backdrop */}
        <div
          className="absolute -z-20"
          style={{
            inset: "var(--cut)",
            borderRadius: "var(--radius)",
            background: "var(--bg)",
          }}
        />
      </button>
    );
  },
);

ShimmerButton.displayName = "ShimmerButton";

export default ShimmerButton;

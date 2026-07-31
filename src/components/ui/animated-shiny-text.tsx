import { type ComponentPropsWithoutRef, type CSSProperties, type FC } from "react";
import { cn } from "@/lib/utils";

/**
 * AnimatedShinyText — a glare that pans across text. Adapted from Magic UI to
 * Tailwind v3 (uses the `shiny-text` keyframes registered in tailwind.config).
 * Tuned for dark surfaces (light glare).
 */
export interface AnimatedShinyTextProps extends ComponentPropsWithoutRef<"span"> {
  shimmerWidth?: number;
}

export const AnimatedShinyText: FC<AnimatedShinyTextProps> = ({
  children,
  className,
  shimmerWidth = 100,
  ...props
}) => {
  return (
    <span
      style={
        {
          "--shiny-width": `${shimmerWidth}px`,
          backgroundSize: "var(--shiny-width) 100%",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "0 0",
        } as CSSProperties
      }
      className={cn(
        "text-white/50",
        "animate-shiny-text bg-clip-text",
        "bg-gradient-to-r from-transparent via-white/90 to-transparent",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
};

export default AnimatedShinyText;

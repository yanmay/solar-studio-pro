import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center group/slider", className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted/40 border border-border/10">
      <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-primary to-amber-500" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-4.5 w-4.5 rounded-full border-2 border-primary bg-background ring-offset-background transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-grab active:cursor-grabbing hover:shadow-[0_0_10px_rgba(255,107,0,0.5)] active:scale-95" />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };

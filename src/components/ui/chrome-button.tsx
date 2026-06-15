import React, { ReactNode, ButtonHTMLAttributes } from "react";
import LiquidChrome from "@/components/ui/liquid-chrome";

export interface ChromeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

const ChromeButton = React.forwardRef<HTMLButtonElement, ChromeButtonProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <button 
        ref={ref}
        className={`relative py-4 px-6 rounded-full border-neutral-900 border-2 bg-neutral-950 overflow-hidden group text-white active:scale-95 transition-all duration-75 shadow-lg ${className || ''}`}
        {...props}
      >
        <div className="absolute inset-0 z-0 opacity-80 group-hover:opacity-100 transition-opacity duration-500">
          <LiquidChrome
            baseColor={[
              1.0, 0.6, 0.0,
            ]}
            speed={2}
            amplitude={0.1}
            interactive={false}
          />
        </div>
        <span className="relative z-10 mix-blend-difference flex items-center justify-center">
          {children}
        </span>
      </button>
    );
  }
);

ChromeButton.displayName = "ChromeButton";

export default ChromeButton;

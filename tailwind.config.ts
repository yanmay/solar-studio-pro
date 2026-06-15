import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        display: ["'DM Serif Display'", "Georgia", "serif"],
        body: ["'DM Sans'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        brand: {
          DEFAULT: "hsl(var(--brand))",
          foreground: "hsl(var(--brand-foreground))",
          orange: "#FF6600",
          dark: "#050505",
          gray: "#1a1a1a",
          text: "#e5e5e5",
        },
        "brand-foreground": "hsl(var(--brand-foreground))",
        sunpower: {
          accent: "hsl(var(--color-accent))",
          "accent-hover": "hsl(var(--color-accent-hover))",
          "accent-text": "hsl(var(--color-accent-text))",
          success: "hsl(var(--color-success))",
          "success-light": "hsl(var(--color-success-light))",
          "success-text": "hsl(var(--color-success-text))",
          info: "hsl(var(--color-info))",
          "info-light": "hsl(var(--color-info-light))",
          "info-text": "hsl(var(--color-info-text))",
          "text-primary": "hsl(var(--color-text-primary))",
          "text-secondary": "hsl(var(--color-text-secondary))",
          "text-muted": "hsl(var(--color-text-muted))",
          "bg-card": "hsl(var(--color-bg-card))",
          "bg-secondary": "hsl(var(--color-bg-secondary))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "14px",
        md: "10px",
        sm: "6px",
        xl: "20px",
        pill: "999px",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        float: "var(--shadow-float)",
      },
      maxWidth: {
        container: "80rem",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-slide-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "infinite-scroll": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-100%)" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        appear: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "appear-zoom": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "infinite-scroll": "infinite-scroll 80s linear infinite",
        "fade-in-up": "fadeInUp 0.8s ease-out forwards",
        "spin-slow": "spin 60s linear infinite",
        "spin-reverse": "spin 40s linear infinite reverse",
        appear: "appear 0.5s ease-out forwards",
        "appear-zoom": "appear-zoom 0.5s ease-out forwards"
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

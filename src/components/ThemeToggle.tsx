import { useState, useEffect, useCallback } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "sunpower-theme";

type ResolvedTheme = "light" | "dark";

/** Read stored preference; default to "light" for consistency */
function getStoredTheme(): ResolvedTheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark") return "dark";
  } catch {
    // ignore errors
  }
  return "light";
}

/** Apply the theme to the DOM */
function applyToDOM(theme: ResolvedTheme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  // Update meta theme-color for mobile browser chrome
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "dark" ? "#111318" : "#E8F4FB");
  }
}

interface ThemeToggleProps {
  className?: string;
}

const ThemeToggle = ({ className = "" }: ThemeToggleProps) => {
  const [isDark, setIsDark] = useState(() => {
    const stored = getStoredTheme();
    return stored === "dark";
  });

  // Sync DOM on mount and state change
  useEffect(() => {
    applyToDOM(isDark ? "dark" : "light");
  }, [isDark]);

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      const theme: ResolvedTheme = next ? "dark" : "light";
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // ignore errors
      }
      applyToDOM(theme);
      return next;
    });
  }, []);

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggle}
      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-card
        ${isDark
          ? "bg-gray-800 text-yellow-300 hover:bg-gray-700 border border-white/10 hover:text-yellow-200"
          : "bg-white text-gray-600 hover:bg-gray-100 border border-black/5 hover:text-gray-800"
        } ${className}`}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? (
        <Sun className="w-[18px] h-[18px]" />
      ) : (
        <Moon className="w-[18px] h-[18px]" />
      )}
    </Button>
  );
};

export default ThemeToggle;

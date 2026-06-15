/**
 * Theme manager — dark/light mode via `dark` class on <html>.
 * Persists choice to localStorage; defaults to system preference.
 */

const STORAGE_KEY = "sunpower-theme";

export type Theme = "light" | "dark" | "system";

/** Read stored preference or default to "system" */
export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch (error) {
    console.warn("localStorage theme access failed:", error);
  }
  return "system";
}

/** Persist user preference */
export function setStoredTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (error) {
    console.warn("localStorage theme save failed:", error);
  }
}

/** Resolve "system" to actual light/dark */
export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

/** Apply resolved theme to the document */
export function applyTheme(theme: Theme) {
  const resolved = resolveTheme(theme);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  // Update meta theme-color for mobile browser chrome
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", resolved === "dark" ? "#111318" : "#E8F4FB");
  }
}

/** Initialize on app start */
export function initTheme() {
  const theme = getStoredTheme();
  applyTheme(theme);

  // Listen for system preference changes
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getStoredTheme() === "system") applyTheme("system");
  });
}

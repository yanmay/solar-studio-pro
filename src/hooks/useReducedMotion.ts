import * as React from "react";

/**
 * Returns true when the user prefers reduced motion (OS setting).
 * Use to gate JS-driven motion; CSS already honors the media query globally.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState<boolean>(false);

  React.useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

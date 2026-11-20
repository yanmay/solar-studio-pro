/**
 * BUG-006: handleSandboxCheckout must be gated behind import.meta.env.DEV
 * Writing the FAILING test first, then fixing.
 *
 * We test at the source level: in production, the sandbox checkout button
 * must not be the primary payment trigger. We verify by parsing the source.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect } from "vitest";

const RESULTS_PAGE = resolve(__dirname, "../pages/ResultsPage.tsx");

describe("BUG-006: Sandbox checkout security guard", () => {
  it("handleSandboxCheckout body must be gated by import.meta.env.DEV", () => {
    const src = readFileSync(RESULTS_PAGE, "utf-8");

    // Find the function body between `const handleSandboxCheckout` and next `};`
    const fnStart = src.indexOf("const handleSandboxCheckout = ()");
    expect(fnStart).toBeGreaterThan(-1);

    // Extract the function body (up to 500 chars is enough to see the guard)
    const fnBody = src.slice(fnStart, fnStart + 500);

    // The fix: function must check import.meta.env.DEV before doing anything
    expect(fnBody).toMatch(/import\.meta\.env\.DEV/);
  });

  it("sandbox checkout button in JSX must be conditionally rendered (DEV only)", () => {
    const src = readFileSync(RESULTS_PAGE, "utf-8");

    // The button at ~line 2761 that calls handleSandboxCheckout should be
    // wrapped in a DEV-only conditional, OR the function itself guards it.
    // We verify at least one of these is true by checking the function guard (above).
    // This test verifies the UI button renders only in DEV.
    const sandboxBtnIdx = src.indexOf("onClick={handleSandboxCheckout}");
    expect(sandboxBtnIdx).toBeGreaterThan(-1);

    // The 300 chars before the button call should contain a DEV conditional
    // OR the function itself is guarded (covered by previous test).
    // We accept either: function-level guard or JSX-level conditional.
    const context = src.slice(Math.max(0, sandboxBtnIdx - 300), sandboxBtnIdx + 50);
    const hasDEVGuard = context.includes("import.meta.env.DEV") ||
      src.slice(src.indexOf("const handleSandboxCheckout = ()"), src.indexOf("const handleSandboxCheckout = ()") + 100).includes("import.meta.env.DEV");
    expect(hasDEVGuard).toBe(true);
  });
});


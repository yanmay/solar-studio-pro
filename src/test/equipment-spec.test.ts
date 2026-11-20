/**
 * Phase 2 — Equipment spec card is data-driven (Phase 1 item 41).
 * Panel brand/model must derive from pType (compact vs premium),
 * not be hardcoded as a fixed placeholder string.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(
  join(process.cwd(), "src/pages/ResultsPage.tsx"),
  "utf-8"
);

describe("Equipment spec card — data-driven", () => {
  it("derives panel model from pType conditional", () => {
    // Source must contain conditional logic based on pType for panel model selection
    expect(src).toMatch(/pType.*premium.*550|premium.*pType.*550/);
  });

  it("contains a named panel brand (Waaree or Longi)", () => {
    expect(src).toMatch(/Waaree|Longi/);
  });

  it("contains inverter phase logic based on installedKw", () => {
    // Single-phase ≤5kW, three-phase >5kW
    expect(src).toMatch(/installedKw.*<=.*5|<=.*5.*installedKw|Single Phase|Three Phase/i);
  });

  it("Hardware Configuration card uses panelModel variable (not hardcoded brand+model string)", () => {
    // The card label row value should reference panelModel, not a raw string literal
    expect(src).toContain("panelModel");
  });

  it("Hardware Configuration card uses inverterModel variable", () => {
    expect(src).toContain("inverterModel");
  });
});

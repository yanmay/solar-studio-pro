/**
 * BUG-005 Option A: Teaser must use model.paybackPeriod (computeModel), not
 * data.investment.paybackYears (runFullCalculation).
 *
 * "Same number everywhere" — the teaser and the paid console both source payback
 * from computeModel, so a user cannot see one number for free and another after paying.
 *
 * This is a source-level (static) test: it checks that the locked teaser section in
 * ResultsPage.tsx does NOT reference data.investment.paybackYears and DOES reference
 * model.paybackPeriod or model.breakEvenYr.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(
  join(process.cwd(), "src/pages/ResultsPage.tsx"),
  "utf-8"
);

// Extract the locked-state section (between LOCKED STATE comment and next section)
const lockedStart = src.indexOf("LOCKED STATE — teaser upgrade layout");
const lockedEnd = src.indexOf("/* ===", lockedStart + 1);
const lockedSection = lockedEnd > -1
  ? src.slice(lockedStart, lockedEnd)
  : src.slice(lockedStart, lockedStart + 4000);

describe("BUG-005 Option A: Teaser payback source", () => {
  it("locked teaser section does NOT reference data.investment.paybackYears", () => {
    expect(lockedSection).not.toContain("data.investment.paybackYears");
  });

  it("locked teaser section references model.paybackPeriod for break-even display", () => {
    expect(lockedSection).toContain("model.paybackPeriod");
  });

  it("locked teaser section references model.yearlySavings for annual saving", () => {
    expect(lockedSection).toContain("model.yearlySavings");
  });

  it("locked teaser section references model.subsidyInr for govt subsidy", () => {
    expect(lockedSection).toContain("model.subsidyInr");
  });

  it("locked teaser section references model.baseAnnualKwh for clean energy", () => {
    expect(lockedSection).toContain("model.baseAnnualKwh");
  });
});

/**
 * Phase 2 — teaser metrics (Phase 1 items 22–25):
 * The locked teaser must expose 7 metrics total, including:
 *   22. break-even period (model.paybackPeriod or model.breakEvenYr)
 *   23. annual saving in ₹ (model.yearlySavings[0])
 *   24. annual clean energy in kWh (model.baseAnnualKwh)
 *   25. computed subsidy amount (model.subsidyInr)
 *
 * Also the existing 3: system size, annual production, 25-yr savings.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(
  join(process.cwd(), "src/pages/ResultsPage.tsx"),
  "utf-8"
);

const lockedStart = src.indexOf("LOCKED STATE — teaser upgrade layout");
const lockedSection = src.slice(lockedStart, lockedStart + 5000);

describe("Teaser metrics completeness (Phase 1 items 22–25)", () => {
  it("shows system size", () => {
    expect(lockedSection).toContain("Est. System Size");
  });

  it("shows annual production", () => {
    expect(lockedSection).toContain("Annual Prod");
  });

  it("shows annual saving in ₹ (item 23)", () => {
    expect(lockedSection).toMatch(/Annual Sav/);
  });

  it("sources annual saving from model.yearlySavings (item 23)", () => {
    expect(lockedSection).toContain("model.yearlySavings");
  });

  it("shows clean energy kWh (item 24)", () => {
    expect(lockedSection).toMatch(/Clean Energ/);
  });

  it("sources clean energy from model.baseAnnualKwh (item 24)", () => {
    expect(lockedSection).toContain("model.baseAnnualKwh");
  });

  it("shows break-even / payback period (item 22)", () => {
    expect(lockedSection).toMatch(/Break.?even|Payback/i);
  });

  it("shows govt subsidy (item 25)", () => {
    expect(lockedSection).toMatch(/Subsid|Govt/);
  });

  it("sources subsidy from model.subsidyInr (item 25)", () => {
    expect(lockedSection).toContain("model.subsidyInr");
  });

  it("shows 25-yr savings", () => {
    expect(lockedSection).toMatch(/25.?Yr|25.?yr/);
  });
});

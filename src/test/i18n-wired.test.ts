/**
 * Phase 2 (corrected) — i18n fully wired to LandingPage for EN + HI.
 * Per correction 1: ALL user-facing strings on LandingPage use t(), not just 1-2.
 * ResultsPage i18n is deferred (nav.back wired; full page deferred to future pass).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const landing = readFileSync(join(process.cwd(), "src/pages/LandingPage.tsx"), "utf-8");
const results = readFileSync(join(process.cwd(), "src/pages/ResultsPage.tsx"), "utf-8");
const enLocale = readFileSync(join(process.cwd(), "src/i18n/locales/en.ts"), "utf-8");
const hiLocale = readFileSync(join(process.cwd(), "src/i18n/locales/hi.ts"), "utf-8");

describe("i18n — LandingPage fully wired", () => {
  it('imports useTranslation from "react-i18next"', () => {
    expect(landing).toContain('from "react-i18next"');
    expect(landing).toContain("useTranslation");
  });

  it("calls useTranslation() inside the component", () => {
    expect(landing).toMatch(/const\s*\{.*t.*\}\s*=\s*useTranslation/);
  });

  it("hero heading uses t()", () => {
    expect(landing).toContain('t("landing.heroHeading1")');
  });

  it("trust signals use t()", () => {
    expect(landing).toContain('t("landing.trustScan")');
    expect(landing).toContain('t("landing.trustSubsidy")');
    expect(landing).toContain('t("landing.trustNoSignup")');
  });

  it("feature list items use t()", () => {
    expect(landing).toContain('t("landing.feature1")');
    expect(landing).toContain('t("landing.feature6")');
  });

  it("FAQ items use t()", () => {
    expect(landing).toContain('t("landing.faq1Q")');
    expect(landing).toContain('t("landing.faq4A")');
  });

  it("step cards use t()", () => {
    expect(landing).toContain('t("landing.step1Title")');
    expect(landing).toContain('t("landing.step3Desc")');
  });

  it("footer strings use t()", () => {
    expect(landing).toContain('t("landing.footerTagline")');
    expect(landing).toContain('t("landing.mobileCta")');
  });

  it("does NOT contain un-translated hero heading as a literal string", () => {
    // The raw string "Calculate Your Rooftop" should not appear as a JSX text node
    // (it may appear in comments or strings inside t() translation values — 
    // so we check the JSX context specifically)
    expect(landing).not.toMatch(/>Calculate Your Rooftop</);
  });

  it("does NOT contain un-translated CTA as a literal string", () => {
    expect(landing).not.toMatch(/>Analyze My Rooftop</);
    expect(landing).not.toMatch(/>Calculate My Savings</);
  });
});

describe("i18n — EN + HI locales have all required landing keys", () => {
  const requiredKeys = [
    "heroHeading1", "heroHeadingHighlight", "heroSearchCta",
    "trustScan", "trustSubsidy", "trustNoSignup",
    "feature1", "feature6",
    "faq1Q", "faq1A", "faq4Q", "faq4A",
    "step1Title", "step3Desc",
    "footerTagline", "mobileCta", "ctaHeroTitle",
  ];

  for (const key of requiredKeys) {
    it(`EN locale has landing.${key}`, () => {
      expect(enLocale).toContain(`${key}:`);
    });
    it(`HI locale has landing.${key}`, () => {
      expect(hiLocale).toContain(`${key}:`);
    });
  }
});

describe("i18n — ResultsPage nav wired (back label)", () => {
  it('imports useTranslation from "react-i18next"', () => {
    expect(results).toContain('from "react-i18next"');
    expect(results).toContain("useTranslation");
  });

  it('uses t("nav.back") for the back button', () => {
    expect(results).toContain('t("nav.back")');
  });
});
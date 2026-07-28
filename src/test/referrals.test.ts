import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  generateReferralCode,
  getOrCreateReferralState,
  captureReferrerCode,
  getReferrerCode,
  clearReferrerCode,
  getReferralShareContent,
  REFERRER_STORAGE_KEY,
  REFERRAL_STATE_STORAGE_KEY
} from "../lib/referrals";

describe("Referral Engine Utilities", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should generate a valid referral code format", () => {
    const code = generateReferralCode();
    expect(code).toMatch(/^REF-[A-Z0-9]{6}$/);
  });

  it("should initialize a new referral state if none exists", () => {
    const state = getOrCreateReferralState();
    expect(state.referralCode).toBeDefined();
    expect(state.referredScansCount).toBe(0);
    expect(state.cashbackEarnedInr).toBe(0);
    expect(state.unlockedDiscount).toBe(false);

    // Verify persistence
    const stored = localStorage.getItem(REFERRAL_STATE_STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toEqual(state);
  });

  it("should capture and persist referrer code from URL parameters", () => {
    const params = new URLSearchParams("ref=TESTCODE123");
    const captured = captureReferrerCode(params);
    expect(captured).toBe("TESTCODE123");
    expect(localStorage.getItem(REFERRER_STORAGE_KEY)).toBe("TESTCODE123");

    // Check discount unlocked status
    const state = getOrCreateReferralState();
    expect(state.unlockedDiscount).toBe(true);
  });

  it("should clear referrer code on demand", () => {
    localStorage.setItem(REFERRER_STORAGE_KEY, "SOME_REF");
    expect(getReferrerCode()).toBe("SOME_REF");
    
    clearReferrerCode();
    expect(getReferrerCode()).toBeNull();
  });

  it("should generate correct viral sharing links", () => {
    const share = getReferralShareContent("MYREFCODE", "123 Solar Street");
    expect(share.referralLink).toBe("https://sunpowerlink.in/?ref=MYREFCODE");
    expect(share.text).toContain("MYREFCODE");
    expect(share.text).toContain("123 Solar Street");
    expect(share.whatsappUrl).toContain(encodeURIComponent("https://sunpowerlink.in/?ref=MYREFCODE"));
  });
});

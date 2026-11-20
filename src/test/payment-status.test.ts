/**
 * BUG-007: api/payment/status.ts only queries the payments table.
 * analysis_sessions.is_full_unlocked is set during verify but never checked in status.
 * Fix: add a fallback query to analysis_sessions when no payment record is found.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect } from "vitest";

const STATUS_API = resolve(__dirname, "../../api/payment/status.ts");

describe("BUG-007: payment/status must check analysis_sessions as fallback", () => {
  it("status.ts must query analysis_sessions table", () => {
    const src = readFileSync(STATUS_API, "utf-8");
    expect(src).toContain("analysis_sessions");
  });

  it("status.ts must check is_full_unlocked column", () => {
    const src = readFileSync(STATUS_API, "utf-8");
    expect(src).toContain("is_full_unlocked");
  });
});

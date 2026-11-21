/**
 * BUG-003: scan_hash missing from destructuring in api/payment/verify.ts
 * The body has scan_hash in its type but the destructuring omits it,
 * so scan_hash is always undefined when writing to the payments table.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect } from "vitest";

const VERIFY_API = resolve(__dirname, "../../api/payment/verify.ts");

describe("BUG-003: scan_hash destructuring in payment verify", () => {
  it("verify.ts must destructure scan_hash from request body", () => {
    const src = readFileSync(VERIFY_API, "utf-8");

    // Find the main destructuring line
    const destructureLine = src
      .split("\n")
      .find(line => line.includes("razorpay_order_id") && line.includes("razorpay_payment_id") && line.includes("const {"));

    expect(destructureLine).toBeTruthy();
    expect(destructureLine).toContain("scan_hash");
  });

  it("verify.ts must reference scan_hash when inserting into payments table", () => {
    const src = readFileSync(VERIFY_API, "utf-8");
    // Find the INSERT block (not the failed-attempt update block)
    const insertIdx = src.indexOf(".insert({");
    expect(insertIdx).toBeGreaterThan(-1);

    // Check that scan_hash appears in the insert block (within 300 chars)
    const afterInsert = src.slice(insertIdx, insertIdx + 300);
    expect(afterInsert).toContain("scan_hash");
  });
});
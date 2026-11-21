/**
 * BUG-001: .env.example uses NEXT_PUBLIC_ prefix instead of VITE_
 * The code reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY but
 * .env.example documents NEXT_PUBLIC_ variants → silent misconfiguration.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect } from "vitest";

const ENV_EXAMPLE = resolve(__dirname, "../../.env.example");
const SUPABASE_LIB = resolve(__dirname, "../lib/supabase.ts");

describe("BUG-001: Env var naming consistency", () => {
  it(".env.example must use VITE_SUPABASE_URL (not NEXT_PUBLIC_)", () => {
    const src = readFileSync(ENV_EXAMPLE, "utf-8");
    expect(src).toContain("VITE_SUPABASE_URL");
    expect(src).not.toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it(".env.example must use VITE_SUPABASE_ANON_KEY (not NEXT_PUBLIC_)", () => {
    const src = readFileSync(ENV_EXAMPLE, "utf-8");
    expect(src).toContain("VITE_SUPABASE_ANON_KEY");
    expect(src).not.toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("supabase.ts must read VITE_SUPABASE_URL", () => {
    const src = readFileSync(SUPABASE_LIB, "utf-8");
    expect(src).toContain("VITE_SUPABASE_URL");
  });

  it("supabase.ts must read VITE_SUPABASE_ANON_KEY", () => {
    const src = readFileSync(SUPABASE_LIB, "utf-8");
    expect(src).toContain("VITE_SUPABASE_ANON_KEY");
  });

  it(".env.example must include SENTRY_DSN for server-side Sentry (P2)", () => {
    const src = readFileSync(ENV_EXAMPLE, "utf-8");
    expect(src).toContain("SENTRY_DSN");
  });
});


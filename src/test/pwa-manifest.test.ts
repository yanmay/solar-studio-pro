/**
 * Phase 2 — PWA manifest name fix (Phase 1 item 50).
 * "SUNPOWER LINK" → "SolarScan AI"
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const viteConfig = readFileSync(
  join(process.cwd(), "vite.config.ts"),
  "utf-8"
);

describe("PWA manifest name", () => {
  it('name does not contain "SUNPOWER LINK"', () => {
    // The manifest name and short_name fields must not use the old branding
    const manifestBlock = viteConfig.slice(
      viteConfig.indexOf("VitePWA"),
      viteConfig.indexOf("VitePWA") + 2000
    );
    expect(manifestBlock).not.toContain("SUNPOWER LINK");
  });

  it('name contains "SolarScan AI"', () => {
    const manifestBlock = viteConfig.slice(
      viteConfig.indexOf("VitePWA"),
      viteConfig.indexOf("VitePWA") + 2000
    );
    expect(manifestBlock).toContain("SolarScan AI");
  });
});

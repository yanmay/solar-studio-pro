import { describe, expect, it } from "vitest";

describe("3D profile API contract", () => {
  it("accepts a bounded rendering profile shape", () => {
    const profile = {
      tilt: 67.5,
      maxZoom: 21,
      textureQuality: "high",
      confidence: 0.84,
      distributionPenalty: 0.02,
      neighborPenalty: 0.01,
      model: "random-forest-v1",
      featureImportance: { network_downlink_mbps: 0.4 },
      schemaVersion: 3,
      policyVersion: 2,
      datasetFingerprint: "a".repeat(64),
    };

    expect(profile.tilt).toBeGreaterThanOrEqual(0);
    expect(profile.tilt).toBeLessThanOrEqual(67.5);
    expect(profile.maxZoom).toBeGreaterThanOrEqual(3);
    expect(["standard", "high"]).toContain(profile.textureQuality);
    expect(profile.confidence).toBeGreaterThanOrEqual(0);
    expect(profile.confidence).toBeLessThanOrEqual(1);
    expect(profile.distributionPenalty).toBeGreaterThanOrEqual(0);
    expect(profile.distributionPenalty).toBeLessThanOrEqual(1);
    expect(profile.model).toMatch(/^random-forest-/);
    expect(profile.featureImportance.network_downlink_mbps).toBeGreaterThan(0);
    expect(profile.schemaVersion).toBe(3);
    expect(profile.datasetFingerprint).toHaveLength(64);
  });

  it("uses rooftop vertex complexity as an input feature", () => {
    const payload = { zoom: 19, roofVertices: 12, viewportWidth: 1440 };
    expect(payload.roofVertices).toBeGreaterThan(4);
    expect(payload.roofVertices).toBeLessThanOrEqual(100);
  });
});

import { describe, expect, it } from "vitest";
import {
  appendTelemetrySample,
  createTelemetryRow,
  createCalibrationProfiles,
  readTelemetryRows,
  summarizeTelemetryRows,
  TELEMETRY_STORAGE_KEY,
  uploadTelemetryRows,
} from "@/lib/three-d-telemetry";

describe("3D telemetry export", () => {
  it("maps measured runtime signals to a trainer-compatible row", () => {
    const row = createTelemetryRow({
      zoom: 19,
      roofVertices: 8,
      viewportWidth: 1440,
      viewportHeight: 900,
      devicePixelRatio: 2,
      networkDownlinkMbps: 25,
      webglAvailable: true,
      tilt: 62,
      maxZoom: 20,
      frameTimeMs: 16,
      mapLoadMs: 1200,
    });

    expect(Object.keys(row)).toEqual([
      "zoom", "roof_vertices", "viewport_width", "viewport_height",
      "device_pixel_ratio", "network_downlink_mbps", "webgl_available",
      "tilt", "max_zoom", "texture_quality_score",
    ]);
    expect(row.texture_quality_score).toBeGreaterThanOrEqual(0);
    expect(row.texture_quality_score).toBeLessThanOrEqual(1);
    expect(row.tilt).toBe(62);
  });

  it("clamps profile targets to values the 3D API can deploy", () => {
    const row = createTelemetryRow({
      zoom: 19, roofVertices: 6, viewportWidth: 1280, viewportHeight: 800,
      devicePixelRatio: 1, networkDownlinkMbps: 10, webglAvailable: true,
      tilt: 10, maxZoom: 4, frameTimeMs: 20, mapLoadMs: 1500,
    });
    expect(row.tilt).toBe(35);
    expect(row.max_zoom).toBe(15);
  });

  it("clamps runtime features to the supported inference domain", () => {
    const row = createTelemetryRow({
      zoom: 30, roofVertices: 200, viewportWidth: 0, viewportHeight: 50000,
      devicePixelRatio: 20, networkDownlinkMbps: -1, webglAvailable: false,
      tilt: 60, maxZoom: 20, frameTimeMs: 20, mapLoadMs: 1500,
    });
    expect(row.zoom).toBe(21);
    expect(row.roof_vertices).toBe(100);
    expect(row.viewport_width).toBe(1);
    expect(row.viewport_height).toBe(16384);
    expect(row.device_pixel_ratio).toBe(8);
    expect(row.network_downlink_mbps).toBe(0);
  });

  it("persists only valid rows and reads an empty store safely", () => {
    const storage = new Map<string, string>();
    const fakeStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    };
    expect(readTelemetryRows(fakeStorage)).toEqual([]);
    const row = createTelemetryRow({
      zoom: 19, roofVertices: 6, viewportWidth: 1280, viewportHeight: 800,
      devicePixelRatio: 1, networkDownlinkMbps: 10, webglAvailable: true,
      tilt: 60, maxZoom: 20, frameTimeMs: 20, mapLoadMs: 1500,
    });
    appendTelemetrySample(row, fakeStorage);
    expect(JSON.parse(storage.get(TELEMETRY_STORAGE_KEY)!)).toHaveLength(1);
    expect(readTelemetryRows(fakeStorage)).toHaveLength(1);

    const replacement = { ...row, texture_quality_score: 0.25 };
    appendTelemetrySample(replacement, fakeStorage);
    expect(readTelemetryRows(fakeStorage)).toHaveLength(1);
    expect(readTelemetryRows(fakeStorage)[0].texture_quality_score).toBe(0.25);
  });

  it("uploads trainer-compatible rows only after explicit invocation", async () => {
    const row = createTelemetryRow({
      zoom: 19, roofVertices: 6, viewportWidth: 1280, viewportHeight: 800,
      devicePixelRatio: 1, networkDownlinkMbps: 10, webglAvailable: true,
      tilt: 60, maxZoom: 20, frameTimeMs: 20, mapLoadMs: 1500,
    });
    const calls: Array<[string, RequestInit]> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return new Response(JSON.stringify({ accepted: 1, total: 16, readyForTraining: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
    const result = await uploadTelemetryRows([row], fetchImpl);
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe("/api/3d-telemetry");
    expect(JSON.parse(String(calls[0][1].body))).toEqual({ rows: [row] });
    expect(result?.readyForTraining).toBe(true);
  });

  it("does not contact the ingestion endpoint when no rows exist", async () => {
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return new Response();
    }) as typeof fetch;
    expect(await uploadTelemetryRows([], fetchImpl)).toBeNull();
    expect(called).toBe(false);
  });

  it("preserves distinct rendering actions for one runtime condition", () => {
    const storage = new Map<string, string>();
    const fakeStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    };
    const base = createTelemetryRow({
      zoom: 19, roofVertices: 6, viewportWidth: 1280, viewportHeight: 800,
      devicePixelRatio: 1, networkDownlinkMbps: 10, webglAvailable: true,
      tilt: 45, maxZoom: 18, frameTimeMs: 20, mapLoadMs: 1500,
    });
    appendTelemetrySample(base, fakeStorage);
    appendTelemetrySample({ ...base, tilt: 60, max_zoom: 20 }, fakeStorage);
    expect(readTelemetryRows(fakeStorage)).toHaveLength(2);
  });

  it("creates bounded lower- and higher-detail calibration profiles", () => {
    expect(createCalibrationProfiles(60, 20)).toEqual([
      { tilt: 50, maxZoom: 19 },
      { tilt: 67.5, maxZoom: 21 },
    ]);
    expect(createCalibrationProfiles(35, 15)).toEqual([
      { tilt: 35, maxZoom: 15 },
      { tilt: 42.5, maxZoom: 16 },
    ]);
  });

  it("summarizes optimized and compared runtime contexts", () => {
    const base = createTelemetryRow({
      zoom: 19, roofVertices: 6, viewportWidth: 1280, viewportHeight: 800,
      devicePixelRatio: 1, networkDownlinkMbps: 10, webglAvailable: true,
      tilt: 45, maxZoom: 18, frameTimeMs: 20, mapLoadMs: 1500,
    });
    const summary = summarizeTelemetryRows([
      base,
      { ...base, tilt: 60, max_zoom: 20 },
      { ...base, viewport_width: 1440 },
    ]);
    expect(summary).toEqual({
      total: 3,
      optimizedContexts: 2,
      comparedContexts: 1,
      requiredComparedContexts: 32,
      readyForTraining: false,
      readyForPromotion: false,
    });
  });

  it("scales comparison readiness with optimized context volume", () => {
    const rows = Array.from({ length: 100 }, (_, index) => createTelemetryRow({
      zoom: 19, roofVertices: 6, viewportWidth: 1000 + index, viewportHeight: 800,
      devicePixelRatio: 1, networkDownlinkMbps: 10, webglAvailable: true,
      tilt: 45, maxZoom: 18, frameTimeMs: 20, mapLoadMs: 1500,
    }));
    const summary = summarizeTelemetryRows(rows);
    expect(summary.requiredComparedContexts).toBe(50);
    expect(summary.readyForPromotion).toBe(false);
  });
});

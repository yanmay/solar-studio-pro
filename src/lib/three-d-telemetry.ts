export const TELEMETRY_STORAGE_KEY = "solar-3d-training-telemetry-v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export type ThreeDTelemetryInput = {
  zoom: number;
  roofVertices: number;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  networkDownlinkMbps: number;
  webglAvailable: boolean;
  tilt: number;
  maxZoom: number;
  frameTimeMs: number;
  mapLoadMs: number;
};

export type ThreeDTelemetryRow = {
  zoom: number;
  roof_vertices: number;
  viewport_width: number;
  viewport_height: number;
  device_pixel_ratio: number;
  network_downlink_mbps: number;
  webgl_available: number;
  tilt: number;
  max_zoom: number;
  texture_quality_score: number;
};

export type ThreeDTelemetrySummary = {
  total: number;
  optimizedContexts: number;
  comparedContexts: number;
  requiredComparedContexts: number;
  readyForTraining: boolean;
  readyForPromotion: boolean;
};

export function summarizeTelemetryRows(rows: ThreeDTelemetryRow[]): ThreeDTelemetrySummary {
  const actionsByRuntime = new Map<string, Set<string>>();
  for (const row of rows) {
    const runtimeKey = [
      row.zoom, row.roof_vertices, row.viewport_width, row.viewport_height,
      row.device_pixel_ratio, row.network_downlink_mbps, row.webgl_available,
    ].join("|");
    const actionKey = `${row.tilt}|${row.max_zoom}`;
    const actions = actionsByRuntime.get(runtimeKey) ?? new Set<string>();
    actions.add(actionKey);
    actionsByRuntime.set(runtimeKey, actions);
  }
  const optimizedContexts = actionsByRuntime.size;
  const comparedContexts = [...actionsByRuntime.values()]
    .filter((actions) => actions.size >= 2).length;
  const requiredComparedContexts = Math.max(32, Math.ceil(optimizedContexts * 0.5));
  return {
    total: rows.length,
    optimizedContexts,
    comparedContexts,
    requiredComparedContexts,
    readyForTraining: optimizedContexts >= 16,
    readyForPromotion: optimizedContexts >= 64 && comparedContexts >= requiredComparedContexts,
  };
}

export function createCalibrationProfiles(tilt: number, maxZoom: number) {
  const lowerTilt = clamp(tilt - 10, 35, 67.5);
  const lowerZoom = clamp(maxZoom - 1, 15, 21);
  const higherTilt = clamp(tilt + 7.5, 35, 67.5);
  const higherZoom = clamp(maxZoom + 1, 15, 21);
  return [
    { tilt: Number(lowerTilt.toFixed(1)), maxZoom: Number(lowerZoom.toFixed(1)) },
    { tilt: Number(higherTilt.toFixed(1)), maxZoom: Number(higherZoom.toFixed(1)) },
  ];
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function assertFinite(values: number[]) {
  if (!values.every(Number.isFinite)) throw new Error("3D telemetry values must be finite numbers");
}

export function createTelemetryRow(input: ThreeDTelemetryInput): ThreeDTelemetryRow {
  assertFinite([
    input.zoom, input.roofVertices, input.viewportWidth, input.viewportHeight,
    input.devicePixelRatio, input.networkDownlinkMbps, input.tilt, input.maxZoom,
    input.frameTimeMs, input.mapLoadMs,
  ]);
  const frameScore = clamp(16.7 / Math.max(input.frameTimeMs, 1), 0, 1);
  const loadScore = clamp(1500 / Math.max(input.mapLoadMs, 1), 0, 1);
  return {
    zoom: clamp(input.zoom, 3, 21),
    roof_vertices: clamp(Math.round(input.roofVertices), 3, 100),
    viewport_width: clamp(Math.round(input.viewportWidth), 1, 16384),
    viewport_height: clamp(Math.round(input.viewportHeight), 1, 16384),
    device_pixel_ratio: clamp(input.devicePixelRatio, 0.1, 8),
    network_downlink_mbps: clamp(input.networkDownlinkMbps, 0, 1000),
    webgl_available: input.webglAvailable ? 1 : 0,
    tilt: clamp(input.tilt, 35, 67.5),
    max_zoom: clamp(input.maxZoom, 15, 21),
    texture_quality_score: Number((frameScore * 0.7 + loadScore * 0.3).toFixed(4)),
  };
}

function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

export function readTelemetryRows(storage?: StorageLike): ThreeDTelemetryRow[] {
  try {
    const activeStorage = resolveStorage(storage);
    if (!activeStorage) return [];
    const parsed = JSON.parse(activeStorage.getItem(TELEMETRY_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendTelemetrySample(row: ThreeDTelemetryRow, storage?: StorageLike) {
  const activeStorage = resolveStorage(storage);
  if (!activeStorage) return;
  const rows = readTelemetryRows(activeStorage);
  const featureKey = (sample: ThreeDTelemetryRow) => [
    sample.zoom, sample.roof_vertices, sample.viewport_width, sample.viewport_height,
    sample.device_pixel_ratio, sample.network_downlink_mbps, sample.webgl_available,
    sample.tilt, sample.max_zoom,
  ].join("|");
  const nextRows = rows.filter((sample) => featureKey(sample) !== featureKey(row));
  activeStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify([...nextRows, row].slice(-500)));
}

export function downloadTelemetryRows(rows = readTelemetryRows()) {
  if (!rows.length) return false;
  const url = URL.createObjectURL(new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "3d-telemetry.json";
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

export async function uploadTelemetryRows(
  rows = readTelemetryRows(),
  fetchImpl: typeof fetch = fetch,
): Promise<{
  accepted: number;
  total: number;
  optimizedContexts: number;
  comparedContexts: number;
  requiredComparedContexts: number;
  readyForTraining: boolean;
  readyForPromotion: boolean;
} | null> {
  if (!rows.length || typeof fetchImpl !== "function") return null;
  try {
    const response = await fetchImpl("/api/3d-telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
      keepalive: true,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

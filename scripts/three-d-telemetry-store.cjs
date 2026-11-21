const fs = require('node:fs');
const path = require('node:path');

const FEATURES = [
  ['zoom', 3, 21],
  ['roof_vertices', 3, 100],
  ['viewport_width', 1, 16384],
  ['viewport_height', 1, 16384],
  ['device_pixel_ratio', 0.1, 8],
  ['network_downlink_mbps', 0, 1000],
  ['webgl_available', 0, 1],
  ['tilt', 35, 67.5],
  ['max_zoom', 15, 21],
  ['texture_quality_score', 0, 1],
];
const MIN_PROMOTION_COMPARISON_CONTEXTS = 32;
const MIN_PROMOTION_COMPARISON_RATE = 0.5;

function validateTelemetryRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new Error('Telemetry row must be an object');
  }
  const normalized = {};
  for (const [key, minimum, maximum] of FEATURES) {
    const value = Number(row[key]);
    if (!Number.isFinite(value) || value < minimum || value > maximum) {
      throw new Error(`Telemetry field '${key}' must be between ${minimum} and ${maximum}`);
    }
    normalized[key] = key === 'webgl_available' ? Math.round(value) : value;
  }
  return normalized;
}

function featureKey(row) {
  return [
    row.zoom, row.roof_vertices, row.viewport_width, row.viewport_height,
    row.device_pixel_ratio, row.network_downlink_mbps, row.webgl_available,
    row.tilt, row.max_zoom,
  ].join('|');
}

function runtimeKey(row) {
  return [
    row.zoom, row.roof_vertices, row.viewport_width, row.viewport_height,
    row.device_pixel_ratio, row.network_downlink_mbps, row.webgl_available,
  ].join('|');
}

function telemetryStoreSummary(rows) {
  const actionsByRuntime = new Map();
  for (const row of rows) {
    const key = runtimeKey(row);
    const action = `${row.tilt}|${row.max_zoom}`;
    if (!actionsByRuntime.has(key)) actionsByRuntime.set(key, new Set());
    actionsByRuntime.get(key).add(action);
  }
  const optimizedContexts = actionsByRuntime.size;
  const comparedContexts = [...actionsByRuntime.values()].filter((actions) => actions.size >= 2).length;
  const requiredComparedContexts = Math.max(
    MIN_PROMOTION_COMPARISON_CONTEXTS,
    Math.ceil(optimizedContexts * MIN_PROMOTION_COMPARISON_RATE),
  );
  return {
    total: rows.length,
    optimizedContexts,
    comparedContexts,
    requiredComparedContexts,
    readyForTraining: optimizedContexts >= 16,
    readyForPromotion: optimizedContexts >= 64 && comparedContexts >= requiredComparedContexts,
  };
}

function mergeTelemetryRows(existing, incoming, limit = 500) {
  const merged = new Map();
  for (const row of [...existing, ...incoming]) {
    try {
      const normalized = validateTelemetryRow(row);
      const key = featureKey(normalized);
      merged.delete(key);
      merged.set(key, normalized);
    } catch {
      // Ignore malformed historical rows while preserving valid observations.
    }
  }
  return [...merged.values()].slice(-limit);
}

function appendTelemetryRows(outputPath, rows) {
  let existing = [];
  try {
    const parsed = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    if (Array.isArray(parsed)) existing = parsed;
  } catch {
    // The first upload creates the file.
  }
  const normalizedIncoming = rows.map(validateTelemetryRow);
  const merged = mergeTelemetryRows(existing, normalizedIncoming);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(merged, null, 2));
  return { accepted: normalizedIncoming.length, ...telemetryStoreSummary(merged) };
}

module.exports = { appendTelemetryRows, mergeTelemetryRows, telemetryStoreSummary, validateTelemetryRow };

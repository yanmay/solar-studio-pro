const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  appendTelemetryRows,
  mergeTelemetryRows,
  telemetryStoreSummary,
  validateTelemetryRow,
} = require('./three-d-telemetry-store.cjs');

function sample(overrides = {}) {
  return {
    zoom: 19,
    roof_vertices: 8,
    viewport_width: 1440,
    viewport_height: 900,
    device_pixel_ratio: 2,
    network_downlink_mbps: 25,
    webgl_available: 1,
    tilt: 62,
    max_zoom: 20,
    texture_quality_score: 0.9,
    ...overrides,
  };
}

test('validates trainer-compatible telemetry rows', () => {
  assert.deepEqual(validateTelemetryRow(sample()), sample());
  assert.throws(() => validateTelemetryRow(sample({ viewport_width: 0 })), /viewport_width/);
  assert.throws(() => validateTelemetryRow({ ...sample(), tilt: undefined }), /tilt/);
});

test('deduplicates feature conditions and caps the dataset at 500 rows', () => {
  const existing = [sample()];
  const replacement = sample({ texture_quality_score: 0.25 });
  const many = Array.from({ length: 510 }, (_, index) => sample({
    zoom: 3 + (index % 19),
    roof_vertices: 3 + (index % 98),
    viewport_width: 320 + index,
  }));
  const merged = mergeTelemetryRows(existing, [...many, replacement]);
  assert.equal(merged.length, 500);
  assert.equal(merged.filter((row) => row.zoom === 19 && row.roof_vertices === 8).length, 1);
});

test('keeps distinct profile actions for the same runtime condition', () => {
  const first = sample({ tilt: 45, max_zoom: 18, texture_quality_score: 0.55 });
  const second = sample({ tilt: 60, max_zoom: 20, texture_quality_score: 0.9 });
  const merged = mergeTelemetryRows([], [first, second]);
  assert.equal(merged.length, 2);
  assert.deepEqual(telemetryStoreSummary(merged), {
    total: 2,
    optimizedContexts: 1,
    comparedContexts: 1,
    requiredComparedContexts: 32,
    readyForTraining: false,
    readyForPromotion: false,
  });
});

test('requires both runtime volume and paired actions for promotion readiness', () => {
  const rows = [];
  for (let index = 0; index < 64; index += 1) {
    const runtime = sample({ viewport_width: 1000 + index });
    rows.push(runtime);
    if (index < 32) rows.push({
      ...runtime,
      tilt: 52,
      max_zoom: 18,
      texture_quality_score: 0.7,
    });
  }
  assert.deepEqual(telemetryStoreSummary(rows), {
    total: 96,
    optimizedContexts: 64,
    comparedContexts: 32,
    requiredComparedContexts: 32,
    readyForTraining: true,
    readyForPromotion: true,
  });
});

test('scales required action comparisons with larger telemetry datasets', () => {
  const rows = [];
  for (let index = 0; index < 100; index += 1) {
    const runtime = sample({ viewport_width: 1000 + index });
    rows.push(runtime);
    if (index < 49) rows.push({
      ...runtime,
      tilt: 52,
      max_zoom: 18,
      texture_quality_score: 0.7,
    });
  }
  const summary = telemetryStoreSummary(rows);
  assert.equal(summary.requiredComparedContexts, 50);
  assert.equal(summary.readyForPromotion, false);
});

test('persists a trainer-ready JSON array', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'solar-3d-telemetry-'));
  const output = path.join(directory, 'telemetry.json');
  try {
    const result = appendTelemetryRows(output, [sample()]);
    assert.equal(result.accepted, 1);
    assert.equal(result.total, 1);
    assert.equal(result.readyForTraining, false);
    assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')), [sample()]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

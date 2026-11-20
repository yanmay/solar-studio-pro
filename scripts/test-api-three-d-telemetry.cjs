const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const test = require('node:test');

function sample() {
  return {
    zoom: 19, roof_vertices: 8, viewport_width: 1440, viewport_height: 900,
    device_pixel_ratio: 2, network_downlink_mbps: 25, webgl_available: 1,
    tilt: 62, max_zoom: 20, texture_quality_score: 0.9,
  };
}

async function request(handleRequest, body, method = 'POST') {
  const request = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  request.method = method;
  request.url = '/api/3d-telemetry';
  request.headers = { host: 'localhost', 'content-length': String(body === undefined ? 0 : JSON.stringify(body).length) };
  let result;
  const response = {
    writeHead: (status) => { result = { status }; },
    end: (payload) => { result.body = JSON.parse(payload); },
  };
  await handleRequest(request, response);
  return result;
}

test('POST /api/3d-telemetry persists valid rows and rejects invalid rows', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'solar-3d-api-'));
  const output = path.join(directory, 'telemetry.json');
  const previous = process.env.SOLAR_3D_TELEMETRY_PATH;
  process.env.SOLAR_3D_TELEMETRY_PATH = output;
  try {
    const { handleRequest } = require('../api-server.cjs');
    const accepted = await request(handleRequest, { rows: [sample()] });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.accepted, 1);
    assert.equal(JSON.parse(fs.readFileSync(output, 'utf8')).length, 1);

    const rejected = await request(handleRequest, { rows: [{ ...sample(), tilt: 90 }] });
    assert.equal(rejected.status, 400);
    assert.match(rejected.body.error, /tilt/);
  } finally {
    if (previous === undefined) delete process.env.SOLAR_3D_TELEMETRY_PATH;
    else process.env.SOLAR_3D_TELEMETRY_PATH = previous;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

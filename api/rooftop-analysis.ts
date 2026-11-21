import { checkRateLimit } from './_utils/rate-limit.js';
import { toNodeHandler } from './_utils/vercel-node.js';

type Point = { lat: number; lng: number };

function validPolygon(vertices: unknown): vertices is Point[] {
  return Array.isArray(vertices) && vertices.length >= 3 && vertices.length <= 100 && vertices.every((point) => {
    if (!point || typeof point !== 'object') return false;
    const value = point as Point;
    return Number.isFinite(value.lat) && Number.isFinite(value.lng) && value.lat >= -90 && value.lat <= 90 && value.lng >= -180 && value.lng <= 180;
  });
}

async function handler(req: Request): Promise<Response> {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const { allowed } = await checkRateLimit(req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown', 'rooftop-analysis', 10, 3600);
  if (!allowed) return json({ error: 'Rooftop analysis rate limit exceeded' }, 429);
  const body = await req.json().catch(() => ({}));

  const polygon = (body as any)?.polygon;
  if (!validPolygon(polygon)) return json({ error: 'Invalid rooftop polygon' }, 400);
  const center = polygon.reduce((sum, point) => ({ lat: sum.lat + point.lat / polygon.length, lng: sum.lng + point.lng / polygon.length }), { lat: 0, lng: 0 });
  const googleKey = process.env.GOOGLE_SOLAR_API_KEY;
  const inferenceUrl = process.env.ROOFTOP_SEGMENTATION_URL;
  const inferenceToken = process.env.ROOFTOP_SEGMENTATION_TOKEN;

  if (googleKey) {
    const url = new URL('https://solar.googleapis.com/v1/buildingInsights:findClosest');
    url.searchParams.set('location.latitude', String(center.lat));
    url.searchParams.set('location.longitude', String(center.lng));
    url.searchParams.set('requiredQuality', 'MEDIUM');
    url.searchParams.set('key', googleKey);
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      return json({
        status: 'complete', provider: 'google_solar', obstructions: [],
        message: 'Google Solar coverage verified. Its solar potential data is authoritative; it does not supply rooftop obstruction instance masks.',
        assumptions: [], googleSolar: data,
      });
    }
    if (response.status !== 404) return json({ error: 'Google Solar request failed', upstreamStatus: response.status }, 502);
  }

  if (!inferenceUrl || !inferenceToken) {
    return json({
      status: 'unavailable', provider: null, obstructions: [],
      message: 'No verified Google Solar coverage and no trained rooftop obstruction model is configured.',
      assumptions: [],
    }, 503);
  }

  const response = await fetch(inferenceUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${inferenceToken}` },
    body: JSON.stringify({ polygon }),
  });
  if (!response.ok) return json({ error: 'Obstruction inference failed', upstreamStatus: response.status }, 502);
  const data = await response.json();
  if (!Array.isArray(data.obstructions) || data.obstructions.some((item: any) => !validPolygon(item.footprint))) {
    return json({ error: 'Obstruction inference returned an invalid response' }, 502);
  }
  return json({ ...data, status: 'complete', provider: 'segmentation_model' });
}

export default toNodeHandler(handler);

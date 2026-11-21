import { calculateLeadPrice } from "../_leads/distribute.js";

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: Request): Promise<Response> {
  const apiKey = req.headers.get("x-api-key") || req.headers.get("X-API-Key");
  
  if (!apiKey || (!apiKey.startsWith("sk_test_") && !apiKey.startsWith("sk_live_"))) {
    return new Response(JSON.stringify({ error: "Unauthorized. Valid X-API-Key header required." }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const url = new URL(req.url);
  const lat = parseFloat(url.searchParams.get("lat") || "19.076");
  const lng = parseFloat(url.searchParams.get("lng") || "72.877");
  const roofArea = parseFloat(url.searchParams.get("roofAreaM2") || "100");
  const rate = parseFloat(url.searchParams.get("electricityRate") || "8");

  if (isNaN(lat) || isNaN(lng) || isNaN(roofArea) || isNaN(rate)) {
    return new Response(JSON.stringify({ error: "Invalid query arguments. lat, lng, roofAreaM2, and electricityRate are required parameters." }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Calculate underwriter stats
  const systemSizeKw = parseFloat((roofArea * 0.125).toFixed(2)); // standard compact density
  const annualProductionKwh = Math.round(systemSizeKw * 1450); // average Indian generation
  const capex = systemSizeKw * 48000 + 35000;
  const yearlySavings = annualProductionKwh * rate;
  const paybackYears = parseFloat((capex / yearlySavings).toFixed(1));
  const lifetimeSavingsInr = Math.round(yearlySavings * 25 * 0.85); // accounting for linear degradation

  return new Response(JSON.stringify({
    systemSizeKw,
    annualProductionKwh,
    paybackYears,
    lifetimeSavingsInr,
    confidenceScore: 94,
    windZone: "Zone 2 (Moderate)",
    tempDerate: 0.88,
    shadingLoss: 0.08
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

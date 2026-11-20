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
  const state = url.searchParams.get("state") || "Maharashtra";
  const systemSizeKw = parseFloat(url.searchParams.get("systemSizeKw") || "3");

  if (isNaN(systemSizeKw) || systemSizeKw <= 0) {
    return new Response(JSON.stringify({ error: "systemSizeKw must be a valid positive number query parameter." }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Calculate under PM Surya Ghar Muft Bijli Yojana rules
  // 1 kWp -> ₹30,000
  // 2 kWp -> ₹60,000
  // 3 kWp+ -> ₹78,000 max
  let eligibleSubsidy = 0;
  if (systemSizeKw >= 3) {
    eligibleSubsidy = 78000;
  } else if (systemSizeKw >= 2) {
    eligibleSubsidy = 60000;
  } else if (systemSizeKw >= 1) {
    eligibleSubsidy = 30000;
  } else {
    eligibleSubsidy = Math.round(systemSizeKw * 30000);
  }

  return new Response(JSON.stringify({
    eligibleSubsidy,
    scheme: "PM Surya Ghar Muft Bijli Yojana (Central subsidy rules)",
    stateBonus: 0,
    stateRegistered: state
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

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

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "imageBase64 is required in post body." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Mock visual classification
    return new Response(JSON.stringify({
      isRoof: true,
      estimatedAreaM2: 120,
      confidence: 92.5
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Malformed JSON payload body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
}

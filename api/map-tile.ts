export const config = {
  runtime: "nodejs",
};

const providers = {
  satellite: (z: number, x: number, y: number) =>
    `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
  labels: (z: number, x: number, y: number) =>
    `https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/${z}/${y}/${x}`,
  street: (z: number, x: number, y: number) =>
    `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
} as const;

type Layer = keyof typeof providers;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const url = new URL(req.url);
  const layer = url.searchParams.get("layer") as Layer | null;
  const z = Number(url.searchParams.get("z"));
  const x = Number(url.searchParams.get("x"));
  const y = Number(url.searchParams.get("y"));
  const maxZoom = layer === "street" ? 20 : 21;
  const maxCoordinate = Number.isInteger(z) && z >= 0 && z <= maxZoom ? 2 ** z : 0;
  if (!layer || !(layer in providers)
    || !Number.isInteger(x) || !Number.isInteger(y)
    || x < 0 || y < 0 || x >= maxCoordinate || y >= maxCoordinate) {
    return Response.json({ error: "Invalid tile request" }, { status: 400 });
  }

  try {
    const tileResponse = await fetch(providers[layer](z, x, y), {
      headers: { "User-Agent": "SunPowerLinkSolarApp/1.0" },
    });
    if (!tileResponse.ok) {
      return Response.json({ error: "Tile provider unavailable" }, { status: 502 });
    }
    return new Response(await tileResponse.arrayBuffer(), {
      headers: {
        "Content-Type": tileResponse.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
      },
    });
  } catch {
    return Response.json({ error: "Tile provider unavailable" }, { status: 502 });
  }
}

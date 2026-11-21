export type BasemapId = "satellite" | "hybrid" | "street";

export const BASEMAP_OPTIONS: Array<{ id: BasemapId; label: string }> = [
  { id: "satellite", label: "Satellite" },
  { id: "hybrid", label: "Hybrid" },
  { id: "street", label: "Street" },
];

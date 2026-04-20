// Rooftop area estimation from a user-uploaded photo.
//
// Strategy: use Hugging Face Inference API to segment the building/roof in
// the image, count roof pixels, then estimate real-world area via a
// user-provided reference (ground truth rule of thumb): typical residential
// rooftop 80 – 250 m² → we ask the user for a "reference width" slider OR
// use a reasonable default of ~120 m² × (roof pixel fraction / median house).
//
// For MVP (no server keys): we run a fully client-side edge-detection +
// luminance-based roof heuristic. This works for top-down / oblique rooftop
// photos in good light. If VITE_HF_TOKEN is set, we upgrade to a proper
// segformer segmentation call.

import { captureApiError } from "./sentry";

export interface RoofPhotoResult {
  /** Estimated roof area in square meters */
  areaM2: number;
  /** Fraction of pixels classified as roof (0..1) */
  roofPixelFraction: number;
  /** Confidence 0..1 — lower if lighting is uneven or shot is not top-down */
  confidence: number;
  /** Raw thumbnail (data URL) with roof highlighted — for visual feedback */
  overlayDataUrl: string;
  /** Whether HF segmentation was used (vs client-side heuristic) */
  source: "hf-segformer" | "client-heuristic";
}

const HF_TOKEN = import.meta.env.VITE_HF_TOKEN;
const HF_MODEL = "nvidia/segformer-b3-finetuned-ade-512-512";

/**
 * Try Hugging Face inference first (if token present), else fall back to a
 * client-side heuristic. Returns a visual overlay + area estimate.
 */
export async function estimateRoofFromPhoto(
  file: File,
  approxHouseFloorM2: number = 120,
): Promise<RoofPhotoResult> {
  // Read image and downscale to 512×512 for processing
  const img = await fileToImage(file);
  const { canvas, ctx } = downscaleTo(img, 512, 512);

  // Try HF segmentation first
  if (HF_TOKEN) {
    try {
      const mask = await segmentWithHF(file);
      if (mask) {
        const analysis = applyMaskAndAnalyze(canvas, ctx, mask, approxHouseFloorM2);
        return { ...analysis, source: "hf-segformer" };
      }
    } catch (err) {
      captureApiError("hf-segformer", err);
      // Fall through to client heuristic
    }
  }

  // Client-side heuristic: luminance + edge-density to identify contiguous
  // "roof" regions. Works for bright top-down photos.
  const heuristic = clientSideRoofDetect(canvas, ctx, approxHouseFloorM2);
  return { ...heuristic, source: "client-heuristic" };
}

// ─── Implementation helpers ──────────────────────────────────

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { resolve(img); URL.revokeObjectURL(url); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function downscaleTo(img: HTMLImageElement, maxW: number, maxH: number) {
  const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
  const w = Math.round(img.naturalWidth * ratio);
  const h = Math.round(img.naturalHeight * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  return { canvas, ctx };
}

async function segmentWithHF(file: File): Promise<Uint8Array | null> {
  const res = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      "Content-Type": file.type || "image/jpeg",
    },
    body: await file.arrayBuffer(),
  });
  if (!res.ok) throw new Error(`HF ${res.status}`);
  const data = await res.json();
  // Response: [{ label, score, mask (base64 PNG) }, ...]
  // We want building / house / roof labels
  const roofLabels = ["building", "house", "roof", "skyscraper"];
  const entry = Array.isArray(data) ? data.find((d) => roofLabels.includes(String(d.label).toLowerCase())) : null;
  if (!entry?.mask) return null;
  // Decode base64 PNG → pixel alpha values
  const maskBytes = await base64PngToAlphaArray(entry.mask);
  return maskBytes;
}

async function base64PngToAlphaArray(b64: string): Promise<Uint8Array> {
  const img = new Image();
  const src = `data:image/png;base64,${b64}`;
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = rej;
    img.src = src;
  });
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  const out = new Uint8Array(c.width * c.height);
  for (let i = 0; i < out.length; i++) out[i] = data[i * 4 + 3]; // alpha channel
  return out;
}

function applyMaskAndAnalyze(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  mask: Uint8Array,
  approxHouseM2: number,
): Omit<RoofPhotoResult, "source"> {
  const { width: w, height: h } = canvas;
  const px = ctx.getImageData(0, 0, w, h);
  const d = px.data;
  let roof = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 128) {
      roof++;
      // Tint roof pixels violet
      d[i * 4 + 0] = Math.min(255, d[i * 4 + 0] * 0.6 + 120);
      d[i * 4 + 1] = d[i * 4 + 1] * 0.5;
      d[i * 4 + 2] = Math.min(255, d[i * 4 + 2] * 0.7 + 120);
    }
  }
  ctx.putImageData(px, 0, 0);
  const frac = roof / (w * h);
  // Relative-area model: if roof covers 40% of the frame, assume it roughly equals approxHouseM2.
  // Scale linearly. Clamp between 20 and 1000 m².
  const ratio = Math.max(0.05, Math.min(0.8, frac)) / 0.40;
  const areaM2 = Math.max(20, Math.min(1000, Math.round(approxHouseM2 * ratio * 10) / 10));
  return {
    areaM2,
    roofPixelFraction: Math.round(frac * 10000) / 10000,
    confidence: frac > 0.1 && frac < 0.75 ? 0.8 : 0.55,
    overlayDataUrl: canvas.toDataURL("image/jpeg", 0.8),
  };
}

/**
 * Client-side heuristic: identify "roof-like" pixels as high-luminance,
 * low-saturation, low-variance regions. Not perfect, but useful when no
 * HF token is configured.
 */
function clientSideRoofDetect(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  approxHouseM2: number,
): Omit<RoofPhotoResult, "source"> {
  const { width: w, height: h } = canvas;
  const px = ctx.getImageData(0, 0, w, h);
  const d = px.data;
  let roof = 0;

  // Step 1: classify each pixel
  const classified = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = d[i * 4 + 0], g = d[i * 4 + 1], b = d[i * 4 + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;   // 0..1
    const sat = max === 0 ? 0 : (max - min) / max;             // 0..1

    // Sky rejection — very blue + high lum
    const isSky = b > r + 15 && b > g + 10 && lum > 0.55;
    // Vegetation rejection — green dominant
    const isVeg = g > r + 10 && g > b + 10;
    // Roof candidates — mid-high luminance, low saturation (concrete / tile),
    // OR specific brownish-red hue (tile roofs)
    const isTile = r > g + 15 && r > b + 25 && sat > 0.25;
    const isFlat = lum > 0.35 && lum < 0.85 && sat < 0.25;

    if (!isSky && !isVeg && (isTile || isFlat)) classified[i] = 1;
  }

  // Step 2: pick the largest connected component (removes scattered noise)
  const component = largestConnected(classified, w, h);
  for (let i = 0; i < component.length; i++) if (component[i]) roof++;

  // Tint the detected roof pixels violet for user feedback
  for (let i = 0; i < component.length; i++) {
    if (component[i]) {
      d[i * 4 + 0] = Math.min(255, d[i * 4 + 0] * 0.55 + 130);
      d[i * 4 + 1] = d[i * 4 + 1] * 0.45;
      d[i * 4 + 2] = Math.min(255, d[i * 4 + 2] * 0.65 + 130);
    }
  }
  ctx.putImageData(px, 0, 0);

  const frac = roof / (w * h);
  const ratio = Math.max(0.05, Math.min(0.8, frac)) / 0.40;
  const areaM2 = Math.max(20, Math.min(1000, Math.round(approxHouseM2 * ratio * 10) / 10));
  return {
    areaM2,
    roofPixelFraction: Math.round(frac * 10000) / 10000,
    confidence: frac > 0.08 && frac < 0.7 ? 0.6 : 0.4,
    overlayDataUrl: canvas.toDataURL("image/jpeg", 0.8),
  };
}

/** BFS largest connected component over a binary image */
function largestConnected(bin: Uint8Array, w: number, h: number): Uint8Array {
  const visited = new Uint8Array(bin.length);
  const label = new Int32Array(bin.length).fill(-1);
  const sizes: number[] = [];
  let maxIdx = 0, maxSize = 0;
  const queue: number[] = [];

  for (let i = 0; i < bin.length; i++) {
    if (!bin[i] || visited[i]) continue;
    queue.length = 0;
    queue.push(i);
    visited[i] = 1;
    const l = sizes.length;
    sizes.push(0);
    while (queue.length) {
      const p = queue.pop()!;
      label[p] = l;
      sizes[l]++;
      const x = p % w, y = (p / w) | 0;
      const neighbors = [
        x > 0 ? p - 1 : -1,
        x < w - 1 ? p + 1 : -1,
        y > 0 ? p - w : -1,
        y < h - 1 ? p + w : -1,
      ];
      for (const n of neighbors) {
        if (n < 0 || visited[n] || !bin[n]) continue;
        visited[n] = 1;
        queue.push(n);
      }
    }
    if (sizes[l] > maxSize) { maxSize = sizes[l]; maxIdx = l; }
  }

  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    if (label[i] === maxIdx) out[i] = 1;
  }
  return out;
}

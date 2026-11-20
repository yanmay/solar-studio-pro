import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Download, Gauge, Layers, Pause, Play, RotateCcw, RotateCw, Upload } from "lucide-react";
import { localizeRoofPolygons } from "@/components/RooftopARViewer";
import {
  appendTelemetrySample,
  createCalibrationProfiles,
  createTelemetryRow,
  downloadTelemetryRows,
  readTelemetryRows,
  summarizeTelemetryRows,
  uploadTelemetryRows,
} from "@/lib/three-d-telemetry";

type Google3DViewProps = {
  center: { lat: number; lng: number } | null;
  zoom: number;
  roofVertices?: number;
  roofPolygons?: Array<Array<{ lat: number; lng: number }>>;
  exclusionZones?: Array<Array<{ lat: number; lng: number }>>;
  className?: string;
  autoRotate?: boolean;
  onHeadingChange?: (heading: number, isAuto?: boolean) => void;
  onSwitchTo2D?: () => void;
};

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };
const SAFE_TILT = 45;
const SAFE_MAX_ZOOM = 18;
const MIN_PROFILE_CONFIDENCE = 0.5;

function normalizePoint(p: any): { lat: number; lng: number } | null {
  if (!p) return null;
  if (typeof p.lat === "number" && typeof p.lng === "number" && !isNaN(p.lat) && !isNaN(p.lng)) {
    return { lat: p.lat, lng: p.lng };
  }
  if (Array.isArray(p) && p.length >= 2) {
    const lat = Number(p[0]);
    const lng = Number(p[1]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }
  return null;
}

function calcShoelaceArea(rawPoints: any[]): number {
  if (!rawPoints || rawPoints.length < 3) return 0;
  const points = rawPoints.map(normalizePoint).filter(Boolean) as Array<{ lat: number; lng: number }>;
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].lng * points[j].lat;
    area -= points[j].lng * points[i].lat;
  }
  const midLat = (points[0].lat * Math.PI) / 180;
  const factor = 111320 * (111320 * Math.cos(midLat));
  return Math.abs(area / 2) * factor;
}

function isPointInPolygon(point: [number, number], vs: [number, number][]): boolean {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

async function loadGoogleMaps3D(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Maps requires a browser"));
  if ((window as any).google?.maps?.importLibrary) {
    return (window as any).google.maps.importLibrary("maps3d");
  }
  // Seamlessly use the local Three.js 3D Digital Twin engine.
  // This completely eliminates Google Maps BillingNotEnabledMapError popups and alpha watermarks.
  return Promise.reject(new Error("Google Maps runtime unavailable; using 3D engine"));
}

export default function Google3DView({
  center,
  zoom,
  roofVertices = 4,
  roofPolygons = [],
  exclusionZones = [],
  className = "",
  autoRotate: initialAutoRotate,
  onHeadingChange,
  onSwitchTo2D,
}: Google3DViewProps) {
  const normalizedSections = (roofPolygons || [])
    .map((section) => {
      if (!section || section.length < 3) return null;
      const pts = section.map(normalizePoint).filter(Boolean) as Array<{ lat: number; lng: number }>;
      if (pts.length < 3) return null;
      const first = pts[0];
      const last = pts[pts.length - 1];
      if (Math.hypot(first.lat - last.lat, first.lng - last.lng) < 0.000005) {
        pts.pop();
      }
      return pts.length >= 3 && calcShoelaceArea(pts) >= 0.5 ? pts : null;
    })
    .filter(Boolean) as Array<Array<{ lat: number; lng: number }>>;

  const normalizedExclusions = (exclusionZones || [])
    .map((section) => {
      if (!section || section.length < 3) return null;
      const pts = section.map(normalizePoint).filter(Boolean) as Array<{ lat: number; lng: number }>;
      return pts.length >= 3 && calcShoelaceArea(pts) >= 0.2 ? pts : null;
    })
    .filter(Boolean) as Array<Array<{ lat: number; lng: number }>>;

  const hasValidRoof = normalizedSections.length > 0;
  const rootRef = useRef<HTMLDivElement>(null);
  const mapRootRef = useRef<HTMLDivElement>(null);
  const threeRootRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const threeSceneRef = useRef<any>(null);
  const [heading, setHeading] = useState(0);
  const [autoRotate, setAutoRotate] = useState(() => initialAutoRotate ?? true);
  const [tilt, setTilt] = useState(SAFE_TILT);
  const [maxZoom, setMaxZoom] = useState(SAFE_MAX_ZOOM);
  const [profileConfidence, setProfileConfidence] = useState<number | null>(null);
  const [profileApplied, setProfileApplied] = useState(false);
  const [telemetryCount, setTelemetryCount] = useState(() => readTelemetryRows().length);
  const [telemetrySummary, setTelemetrySummary] = useState(() => summarizeTelemetryRows(readTelemetryRows()));
  const [telemetryUploading, setTelemetryUploading] = useState(false);
  const [calibrationActive, setCalibrationActive] = useState(false);
  const [mapRenderer, setMapRenderer] = useState<"photorealistic-3d" | "three-fallback" | "css-fallback" | "unavailable">("unavailable");
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const mapRendererRef = useRef(mapRenderer);
  const headingRef = useRef(0);
  const profileRef = useRef({ tilt: SAFE_TILT, maxZoom: SAFE_MAX_ZOOM });
  const runtimeRef = useRef({ zoom, roofVertices });
  const mapChangeStartedRef = useRef(0);
  const telemetrySamplingRef = useRef(false);
  const telemetrySamplerRef = useRef<(() => void) | null>(null);
  const calibrationActiveRef = useRef(false);
  const calibrationFallbackRef = useRef<number | null>(null);
  const calibrationQueueRef = useRef<Array<{ tilt: number; maxZoom: number }>>([]);
  const calibrationRestoreRef = useRef<{ tilt: number; maxZoom: number } | null>(null);
  runtimeRef.current = { zoom, roofVertices };
  mapRendererRef.current = mapRenderer;

  const setNormalizedHeading = (value: number, isAuto = false) => {
    const next = ((value % 360) + 360) % 360;
    headingRef.current = next;
    setHeading(next);
    onHeadingChange?.(next, isAuto);
  };

  const applyRenderingProfile = (profile: { tilt: number; maxZoom: number }) => {
    profileRef.current = profile;
    setTilt(profile.tilt);
    setMaxZoom(profile.maxZoom);
    if (calibrationActiveRef.current) {
      if (calibrationFallbackRef.current !== null) {
        window.clearTimeout(calibrationFallbackRef.current);
      }
      calibrationFallbackRef.current = window.setTimeout(() => {
        calibrationFallbackRef.current = null;
        telemetrySamplerRef.current?.();
      }, 1500);
    }
  };

  const startCalibration = () => {
    if (!mapReady || calibrationActive) return;
    const restore = { ...profileRef.current };
    const [first, ...remaining] = createCalibrationProfiles(restore.tilt, restore.maxZoom);
    calibrationRestoreRef.current = restore;
    calibrationQueueRef.current = remaining;
    calibrationActiveRef.current = true;
    setCalibrationActive(true);
    profileRef.current = first;
    setTilt(first.tilt);
    setMaxZoom(first.maxZoom);
    calibrationFallbackRef.current = window.setTimeout(() => {
      calibrationFallbackRef.current = null;
      telemetrySamplerRef.current?.();
    }, 1500);
  };

  const rotate = (delta: number) => {
    setAutoRotate(false);
    setNormalizedHeading(headingRef.current + delta, false);
  };

  useEffect(() => {
    const controller = new AbortController();
    const webglAvailable = typeof WebGLRenderingContext !== "undefined";
    fetch("/api/3d-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        zoom,
        roofVertices,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
        webglAvailable,
        networkDownlinkMbps: Number((navigator as Navigator & { connection?: { downlink?: number } }).connection?.downlink ?? 10),
      }),
    })
      .then((response) => response.ok ? response.json() : null)
      .then((profile) => {
        if (!profile) return;
        const confidence = Number.isFinite(profile.confidence)
          ? Math.max(0, Math.min(1, profile.confidence))
          : null;
        setProfileConfidence(confidence);
        if (confidence === null || confidence < MIN_PROFILE_CONFIDENCE) {
          profileRef.current = { tilt: SAFE_TILT, maxZoom: SAFE_MAX_ZOOM };
          setTilt(SAFE_TILT);
          setMaxZoom(SAFE_MAX_ZOOM);
          setProfileApplied(false);
          return;
        }
        if (Number.isFinite(profile.tilt)) {
          const nextTilt = Math.max(35, Math.min(67.5, profile.tilt));
          profileRef.current.tilt = nextTilt;
          setTilt(nextTilt);
        }
        if (Number.isFinite(profile.maxZoom)) {
          const nextMaxZoom = Math.max(15, Math.min(21, profile.maxZoom));
          profileRef.current.maxZoom = nextMaxZoom;
          setMaxZoom(nextMaxZoom);
        }
        setProfileApplied(true);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [roofVertices, zoom]);

  useEffect(() => {
    let cancelled = false;
    const fallbackTimer = window.setTimeout(() => {
      if (cancelled || mapRef.current) return;
      setMapError(null);
      setMapRenderer(typeof WebGLRenderingContext === "undefined" ? "css-fallback" : "three-fallback");
      setMapReady(true);
    }, 50);
    loadGoogleMaps3D()
      .then((library) => {
        if (cancelled || !mapRootRef.current || mapRef.current || mapRendererRef.current !== "unavailable") return;
        const Map3DElement = library?.Map3DElement;
        if (!Map3DElement) throw new Error("Map3DElement is unavailable");
        mapChangeStartedRef.current = performance.now();
        const camera = new Map3DElement();
        camera.center = {
          lat: (center || DEFAULT_CENTER).lat,
          lng: (center || DEFAULT_CENTER).lng,
          altitude: 0,
        };
        camera.range = 1200;
        camera.tilt = tilt;
        camera.heading = headingRef.current;
        camera.mode = library?.MapMode?.HYBRID ?? "HYBRID";
        camera.style.width = "100%";
        camera.style.height = "100%";
        camera.style.display = "block";
        camera.setAttribute?.("interactive", "");
        mapRootRef.current.appendChild(camera);
        mapRef.current = camera;
        setMapError(null);
        setMapRenderer("photorealistic-3d");
        setMapReady(true);
        telemetrySamplerRef.current = () => {
          if (cancelled || telemetrySamplingRef.current) return;
          if (calibrationFallbackRef.current !== null) {
            window.clearTimeout(calibrationFallbackRef.current);
            calibrationFallbackRef.current = null;
          }
          telemetrySamplingRef.current = true;
          const mapLoadMs = Math.max(performance.now() - mapChangeStartedRef.current, 1);
          const measuredRuntime = { ...runtimeRef.current };
          const measuredProfile = { ...profileRef.current };
          let previousFrame = performance.now();
          let frameCount = 0;
          let totalFrameTime = 0;
          const sampleFrame = (now: number) => {
            if (cancelled) {
              telemetrySamplingRef.current = false;
              return;
            }
            totalFrameTime += now - previousFrame;
            previousFrame = now;
            frameCount += 1;
            if (frameCount < 30) {
              requestAnimationFrame(sampleFrame);
              return;
            }
            try {
              const row = createTelemetryRow({
                zoom: measuredRuntime.zoom,
                roofVertices: measuredRuntime.roofVertices,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                devicePixelRatio: window.devicePixelRatio || 1,
                networkDownlinkMbps: Number((navigator as Navigator & { connection?: { downlink?: number } }).connection?.downlink ?? 10),
                webglAvailable: typeof WebGLRenderingContext !== "undefined",
                tilt: measuredProfile.tilt,
                maxZoom: measuredProfile.maxZoom,
                frameTimeMs: totalFrameTime / frameCount,
                mapLoadMs,
              });
              appendTelemetrySample(row);
              const nextRows = readTelemetryRows();
              setTelemetryCount(nextRows.length);
              setTelemetrySummary(summarizeTelemetryRows(nextRows));
              const nextCalibrationProfile = calibrationQueueRef.current.shift();
              if (nextCalibrationProfile) {
                applyRenderingProfile(nextCalibrationProfile);
              } else if (calibrationRestoreRef.current) {
                const restore = calibrationRestoreRef.current;
                calibrationRestoreRef.current = null;
                calibrationActiveRef.current = false;
                applyRenderingProfile(restore);
                setCalibrationActive(false);
              }
            } finally {
              telemetrySamplingRef.current = false;
            }
          };
          requestAnimationFrame(sampleFrame);
        };
        camera.addEventListener?.("gmp-animationend", () => telemetrySamplerRef.current?.());
      })
      .catch((error) => {
        if (cancelled || !mapRootRef.current || mapRendererRef.current !== "unavailable") return;
        telemetrySamplerRef.current = () => {
          if (cancelled || telemetrySamplingRef.current) return;
          telemetrySamplingRef.current = true;
          const measuredRuntime = { ...runtimeRef.current };
          const measuredProfile = { ...profileRef.current };
          const startedAt = performance.now();
          requestAnimationFrame((now) => {
            try {
              appendTelemetrySample(createTelemetryRow({
                zoom: measuredRuntime.zoom,
                roofVertices: measuredRuntime.roofVertices,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                devicePixelRatio: window.devicePixelRatio || 1,
                networkDownlinkMbps: Number((navigator as Navigator & { connection?: { downlink?: number } }).connection?.downlink ?? 10),
                webglAvailable: typeof WebGLRenderingContext !== "undefined",
                tilt: measuredProfile.tilt,
                maxZoom: measuredProfile.maxZoom,
                frameTimeMs: Math.max(now - startedAt, 1),
                mapLoadMs: Math.max(startedAt - mapChangeStartedRef.current, 1),
              }));
              const nextRows = readTelemetryRows();
              setTelemetryCount(nextRows.length);
              setTelemetrySummary(summarizeTelemetryRows(nextRows));
              const nextCalibrationProfile = calibrationQueueRef.current.shift();
              if (nextCalibrationProfile) {
                applyRenderingProfile(nextCalibrationProfile);
              } else if (calibrationRestoreRef.current) {
                const restore = calibrationRestoreRef.current;
                calibrationRestoreRef.current = null;
                calibrationActiveRef.current = false;
                applyRenderingProfile(restore);
                setCalibrationActive(false);
              }
            } finally {
              telemetrySamplingRef.current = false;
            }
          });
        };
        setMapError(null);
        setMapRenderer(typeof WebGLRenderingContext === "undefined" ? "css-fallback" : "three-fallback");
        setMapReady(true);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
      calibrationActiveRef.current = false;
      telemetrySamplerRef.current = null;
      if (calibrationFallbackRef.current !== null) {
        window.clearTimeout(calibrationFallbackRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    mapChangeStartedRef.current = performance.now();
    if (mapRenderer === "photorealistic-3d" && map) {
      map.heading = headingRef.current;
      map.tilt = tilt;
      map.range = Math.max(250, 2400 / Math.max(3, Math.min(maxZoom, Math.round(zoom)) - 2));
      if (center) map.center = { ...center, altitude: 0 };
    } else if (mapRenderer === "three-fallback" && threeSceneRef.current) {
      const { camera, target, camDistance } = threeSceneRef.current;
      const pitch = Math.max(0.25, Math.min(1.35, ((90 - tilt) * Math.PI) / 180));
      const distance = Math.max(camDistance || 25, 45 - Math.min(maxZoom, 21));
      camera.position.set(
        target.x + Math.sin((headingRef.current * Math.PI) / 180) * distance * Math.cos(pitch),
        target.y + distance * Math.sin(pitch),
        target.z + Math.cos((headingRef.current * Math.PI) / 180) * distance * Math.cos(pitch),
      );
      camera.lookAt(target);
      camera.updateProjectionMatrix();
    }
  }, [center, zoom, heading, tilt, maxZoom, mapRenderer]);

  useEffect(() => {
    if (mapRenderer === "unavailable" || !autoRotate) return;
    const interval = window.setInterval(() => setNormalizedHeading(headingRef.current + 1, true), 80);
    return () => window.clearInterval(interval);
  }, [autoRotate, mapRenderer]);

  useEffect(() => {
    if (mapRenderer !== "three-fallback" || !threeRootRef.current || className.includes("hidden")) return;
    let disposed = false;
    let animationFrame = 0;
    let observer: ResizeObserver | null = null;
    import("three").then((THREE) => {
      if (disposed || !threeRootRef.current) return;
      const root = threeRootRef.current;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0c1420);
      scene.fog = new THREE.FogExp2(0x0c1420, 0.008);

      const width = Math.max(root.clientWidth || window.innerWidth, 1);
      const height = Math.max(root.clientHeight || window.innerHeight, 1);
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.setClearColor(0x0c1420, 1);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      root.replaceChildren(renderer.domElement);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      renderer.domElement.style.cursor = "grab";

      // ── Atmosphere & Lighting ──
      const hemiLight = new THREE.HemisphereLight(0xd9e8ff, 0x1f2e3d, 1.4);
      scene.add(hemiLight);

      const sun = new THREE.DirectionalLight(0xfff5dd, 2.5);
      sun.position.set(24, 45, 30);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -40;
      sun.shadow.camera.right = 40;
      sun.shadow.camera.top = 40;
      sun.shadow.camera.bottom = -40;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 150;
      sun.shadow.bias = -0.0005;
      scene.add(sun);

      const rimLight = new THREE.DirectionalLight(0x406080, 0.6);
      rimLight.position.set(-30, 20, -30);
      scene.add(rimLight);

      // ── Satellite Ground Plane (High-res photographic ground terrain) ──
      const centerCoords = center || DEFAULT_CENTER;
      const validSections = normalizedSections;
      const hasRoof = validSections.length > 0;

      // Centroid of all valid roof sections (or searched map center)
      const allPts = hasRoof ? validSections.flat() : [centerCoords];
      const refLat = allPts.reduce((sum, p) => sum + p.lat, 0) / allPts.length;
      const refLng = allPts.reduce((sum, p) => sum + p.lng, 0) / allPts.length;

      const latRad = (refLat * Math.PI) / 180;
      const latMeters = 111320;
      const lngMeters = 111320 * Math.cos(latRad);

      const zoomLevel = 19;
      const nTiles = Math.pow(2, zoomLevel);
      const centerTileX = ((refLng + 180) / 360) * nTiles;
      const centerTileY = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * nTiles;
      const baseTileX = Math.floor(centerTileX);
      const baseTileY = Math.floor(centerTileY);

      // Tile dimensions in metric coordinates
      const metersPerTile = (Math.cos(latRad) * 2 * Math.PI * 6378137) / nTiles;
      const groundSize = metersPerTile * 3;

      const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize, 1, 1);
      const groundMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
        metalness: 0.05,
      });

      // Composite 3x3 high-resolution satellite tiles
      const tileSize = 256;
      const canvas = document.createElement("canvas");
      canvas.width = tileSize * 3;
      canvas.height = tileSize * 3;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      const groundTex = new THREE.CanvasTexture(canvas);
      groundTex.wrapS = THREE.ClampToEdgeWrapping;
      groundTex.wrapT = THREE.ClampToEdgeWrapping;
      groundTex.generateMipmaps = true;
      groundMat.map = groundTex;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const tx = baseTileX + dx;
          const ty = baseTileY + dy;
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            if (disposed) return;
            ctx?.drawImage(img, (dx + 1) * tileSize, (dy + 1) * tileSize);
            groundTex.needsUpdate = true;
          };
          img.src = `https://mt1.google.com/vt/lyrs=s&x=${tx}&y=${ty}&z=${zoomLevel}`;
        }
      }

      // Ground plane in X-Z plane
      const groundMesh = new THREE.Mesh(groundGeo, groundMat);
      groundMesh.rotation.x = -Math.PI / 2;
      groundMesh.receiveShadow = true;

      // Position ground mesh so that the center tile offset aligns with (refLng, refLat)
      const pixelOffsetX = (centerTileX - (baseTileX + 0.5)) * (metersPerTile / tileSize) * 256;
      const pixelOffsetZ = (centerTileY - (baseTileY + 0.5)) * (metersPerTile / tileSize) * 256;
      groundMesh.position.set(-pixelOffsetX, 0, pixelOffsetZ);
      scene.add(groundMesh);

      // Subtle architectural grid over ground
      const grid = new THREE.GridHelper(groundSize, 24, 0x38bdf8, 0x1e3a5f);
      grid.position.y = 0.02;
      (grid.material as THREE.Material).opacity = 0.2;
      (grid.material as THREE.Material).transparent = true;
      scene.add(grid);

      // ── 3D Architectural / Agricultural Digital Twin ──
      const buildingGroup = new THREE.Group();
      scene.add(buildingGroup);

      const totalSurveyArea = validSections.reduce((sum, sec) => sum + calcShoelaceArea(sec), 0);
      const isFarm = totalSurveyArea > 1200;
      const houseH = isFarm ? 0.9 : 3.6;

      const wallMat = new THREE.MeshStandardMaterial({ color: 0xede8df, roughness: 0.8, metalness: 0.1 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x3d352e, roughness: 0.95 });
      const parapetMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c8, roughness: 0.85 });
      const mumtyMat = new THREE.MeshStandardMaterial({ color: 0xded8ce, roughness: 0.8 });
      const tankMat = new THREE.MeshStandardMaterial({ color: 0x1d3557, roughness: 0.4, metalness: 0.2 });
      const platformMat = new THREE.MeshStandardMaterial({ color: 0x8d99ae, roughness: 0.7, metalness: 0.5 });
      const coolerMat = new THREE.MeshStandardMaterial({ color: 0xadb5bd, roughness: 0.3, metalness: 0.7 });
      const panelGlassMat = new THREE.MeshStandardMaterial({ color: 0x071b38, metalness: 0.88, roughness: 0.12 });
      const frameMat = new THREE.MeshStandardMaterial({ color: 0xb0bec5, metalness: 0.9, roughness: 0.25 });
      const postMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7, metalness: 0.8 });

      // Convert exclusion zones to local 2D coordinate obstacles
      const localObstacles = normalizedExclusions.map((zone) => {
        return zone.map((pt) => [
          (pt.lng - refLng) * lngMeters,
          (pt.lat - refLat) * latMeters,
        ] as [number, number]);
      });

      // Render user-drawn exclusion / obstacle zones in 3D
      localObstacles.forEach((obsPts) => {
        if (obsPts.length < 3) return;
        const obsShape = new THREE.Shape();
        obsShape.moveTo(obsPts[0][0], obsPts[0][1]);
        for (let i = 1; i < obsPts.length; i++) obsShape.lineTo(obsPts[i][0], obsPts[i][1]);
        obsShape.closePath();

        const obsH = 1.4;
        const obsGeo = new THREE.ExtrudeGeometry(obsShape, { depth: obsH, bevelEnabled: false });
        const obsMesh = new THREE.Mesh(obsGeo, platformMat);
        obsMesh.rotation.x = -Math.PI / 2;
        obsMesh.position.set(0, houseH + 0.15, 0);
        obsMesh.castShadow = true;
        obsMesh.receiveShadow = true;
        buildingGroup.add(obsMesh);

        // Water tank on top of obstacle platform
        const cX = obsPts.reduce((s, p) => s + p[0], 0) / obsPts.length;
        const cY = obsPts.reduce((s, p) => s + p[1], 0) / obsPts.length;
        const tankGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.1, 16);
        const tankMesh = new THREE.Mesh(tankGeo, tankMat);
        tankMesh.position.set(cX, houseH + 0.15 + obsH + 0.55, -cY);
        tankMesh.castShadow = true;
        buildingGroup.add(tankMesh);
      });

      let maxRoofExtent = 15;

      if (hasRoof) {
        validSections.forEach((section) => {
          const localPts = section.map((pt) => [
            (pt.lng - refLng) * lngMeters,
            (pt.lat - refLat) * latMeters,
          ] as [number, number]);

          // Check winding order (Shoelace in local 2D)
          let signedArea = 0;
          for (let i = 0; i < localPts.length; i++) {
            const j = (i + 1) % localPts.length;
            signedArea += localPts[i][0] * localPts[j][1] - localPts[j][0] * localPts[i][1];
          }
          const pts = signedArea < 0 ? [...localPts].reverse() : localPts;

          // Three.js shape
          const shape = new THREE.Shape();
          shape.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length; i++) {
            shape.lineTo(pts[i][0], pts[i][1]);
          }
          shape.closePath();

          if (!isFarm) {
            // Extrude building walls
            const houseGeo = new THREE.ExtrudeGeometry(shape, { depth: houseH, bevelEnabled: false });
            const houseMesh = new THREE.Mesh(houseGeo, wallMat);
            houseMesh.rotation.x = -Math.PI / 2;
            houseMesh.position.set(0, 0, 0);
            houseMesh.castShadow = true;
            houseMesh.receiveShadow = true;
            buildingGroup.add(houseMesh);

            // Roof slab
            const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.15, bevelEnabled: false });
            const slabMesh = new THREE.Mesh(slabGeo, roofMat);
            slabMesh.rotation.x = -Math.PI / 2;
            slabMesh.position.set(0, houseH, 0);
            slabMesh.castShadow = true;
            slabMesh.receiveShadow = true;
            buildingGroup.add(slabMesh);

            // Boundary parapet wall along perimeter
            const parapetGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: false });
            const parapetMesh = new THREE.Mesh(parapetGeo, parapetMat);
            parapetMesh.rotation.x = -Math.PI / 2;
            parapetMesh.position.set(0, houseH + 0.15, 0);
            parapetMesh.castShadow = true;
            buildingGroup.add(parapetMesh);
          } else {
            // Ground-mount solar farm / agricultural field foundation
            const farmBedGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false });
            const farmBedMesh = new THREE.Mesh(farmBedGeo, roofMat);
            farmBedMesh.rotation.x = -Math.PI / 2;
            farmBedMesh.position.set(0, 0, 0);
            farmBedMesh.receiveShadow = true;
            buildingGroup.add(farmBedMesh);

            // Boundary fence posts
            for (let i = 0; i < pts.length; i++) {
              const p1 = pts[i];
              const p2 = pts[(i + 1) % pts.length];
              const edgeDist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
              const postCount = Math.max(2, Math.floor(edgeDist / 4));
              for (let k = 0; k < postCount; k++) {
                const t = k / postCount;
                const fx = p1[0] + (p2[0] - p1[0]) * t;
                const fy = p1[1] + (p2[1] - p1[1]) * t;
                const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), postMat);
                post.position.set(fx, 0.7, -fy);
                post.castShadow = true;
                buildingGroup.add(post);
              }
            }
          }

          // Bounds of this section
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          pts.forEach(([x, y]) => {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          });

          const spanX = maxX - minX;
          const spanY = maxY - minY;
          if (spanX > maxRoofExtent) maxRoofExtent = spanX;
          if (spanY > maxRoofExtent) maxRoofExtent = spanY;

          // Rooftop Mumty (Staircase penthouse), Water Tank & Cooler platform
          const mumtyW = Math.min(2.8, spanX * 0.28);
          const mumtyL = Math.min(2.4, spanY * 0.25);
          const mumtyH = 2.4;
          const mx = minX + mumtyW / 2 + 1.0;
          const my = maxY - mumtyL / 2 - 1.0;

          if (!isFarm && spanX > 8 && spanY > 8 && isPointInPolygon([mx, my], pts)) {
            // Mumty staircase penthouse
            const mumtyGeo = new THREE.BoxGeometry(mumtyW, mumtyH, mumtyL);
            const mumtyMesh = new THREE.Mesh(mumtyGeo, mumtyMat);
            mumtyMesh.position.set(mx, houseH + mumtyH / 2 + 0.15, -my);
            mumtyMesh.castShadow = true;
            mumtyMesh.receiveShadow = true;
            buildingGroup.add(mumtyMesh);

            // Elevated Water Tank on Mumty
            const tankGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.1, 16);
            const tankMesh = new THREE.Mesh(tankGeo, tankMat);
            tankMesh.position.set(mx, houseH + mumtyH + 0.7, -my);
            tankMesh.castShadow = true;
            buildingGroup.add(tankMesh);

            // Water cooler / AC outdoor condenser unit on roof deck
            const coolerGeo = new THREE.BoxGeometry(0.9, 0.7, 0.5);
            const coolerMesh = new THREE.Mesh(coolerGeo, coolerMat);
            coolerMesh.position.set(minX + 2.2, houseH + 0.5, -(minY + 2.2));
            coolerMesh.castShadow = true;
            buildingGroup.add(coolerMesh);
          }

          // Solar panel grid placement
          const panelW = 1.1;
          const panelL = 1.9;
          const stepX = panelW + 0.18;
          const stepY = panelL + 0.22;

          for (let px = minX + 0.7; px <= maxX - 0.7; px += stepX) {
            for (let py = minY + 1.0; py <= maxY - 1.0; py += stepY) {
              const inObstacle = localObstacles.some((obs) => isPointInPolygon([px, py], obs));
              const inMumty = !isFarm && spanX > 8 && spanY > 8 && Math.abs(px - mx) < (mumtyW / 2 + 0.5) && Math.abs(py - my) < (mumtyL / 2 + 0.5);

              if (isPointInPolygon([px, py], pts) && !inObstacle && !inMumty) {
                const panel = new THREE.Mesh(new THREE.BoxGeometry(panelW, 0.05, panelL), panelGlassMat);
                panel.position.set(px, houseH + 0.20, -py);
                panel.rotation.x = ((tilt || 25) * Math.PI) / 180 * 0.45;
                panel.castShadow = true;
                panel.receiveShadow = true;
                buildingGroup.add(panel);

                const rail = new THREE.Mesh(new THREE.BoxGeometry(panelW * 0.95, 0.04, 0.05), frameMat);
                rail.position.set(px, houseH + 0.14, -py);
                buildingGroup.add(rail);

                if (isFarm) {
                  // Steel ground mounting pilings
                  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, houseH + 0.14, 6), postMat);
                  leg.position.set(px, (houseH + 0.14) / 2, -py);
                  leg.castShadow = true;
                  buildingGroup.add(leg);
                }
              }
            }
          }
        });
      }

      // ── Surrounding Trees & Vegetation (Realistic Shading & Landscape Twin) ──
      const treeGroup = new THREE.Group();
      scene.add(treeGroup);

      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.95 });
      const foliageMat1 = new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.85, flatShading: true });
      const foliageMat2 = new THREE.MeshStandardMaterial({ color: 0x40916c, roughness: 0.85, flatShading: true });
      const foliageMat3 = new THREE.MeshStandardMaterial({ color: 0x1b4332, roughness: 0.85, flatShading: true });

      const createTree = (tx: number, tz: number, scale: number = 1, isConifer: boolean = false) => {
        const singleTree = new THREE.Group();
        const trunkH = 2.4 * scale;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.28 * scale, trunkH, 7), trunkMat);
        trunk.position.y = trunkH / 2;
        trunk.castShadow = true;
        singleTree.add(trunk);

        if (isConifer) {
          for (let c = 0; c < 3; c++) {
            const cone = new THREE.Mesh(
              new THREE.ConeGeometry((1.5 - c * 0.35) * scale, (1.6 - c * 0.2) * scale, 7),
              foliageMat3
            );
            cone.position.y = trunkH + (c * 0.85 + 0.45) * scale;
            cone.castShadow = true;
            singleTree.add(cone);
          }
        } else {
          const mat = scale > 1.2 ? foliageMat1 : foliageMat2;
          const c1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4 * scale, 1), mat);
          c1.position.set(0, trunkH + 1.1 * scale, 0);
          c1.castShadow = true;
          singleTree.add(c1);

          const c2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.0 * scale, 1), mat);
          c2.position.set(0.5 * scale, trunkH + 1.5 * scale, 0.3 * scale);
          c2.castShadow = true;
          singleTree.add(c2);
        }
        singleTree.position.set(tx, 0, tz);
        treeGroup.add(singleTree);
      };

      // Place 10 trees around the surveyed boundary at realistic landscape offsets
      const treeDistance = Math.max(maxRoofExtent * 0.75 + 5, 14);
      const treeAngles = [0, 40, 75, 115, 160, 200, 245, 285, 325, 350];
      treeAngles.forEach((deg, idx) => {
        const rad = (deg * Math.PI) / 180;
        const dist = treeDistance + (idx % 3) * 6;
        const tx = Math.sin(rad) * dist;
        const tz = Math.cos(rad) * dist;
        createTree(tx, tz, 0.95 + (idx % 4) * 0.3, idx % 3 === 0);
      });

      // Camera target and orbital distance
      const target = new THREE.Vector3(0, hasRoof ? houseH * 0.8 : 0, 0);
      const camDistance = Math.max(22, Math.min(120, maxRoofExtent * 2.2));
      threeSceneRef.current = { camera, target, renderer, scene, camDistance };

      const updateCamera = () => {
        const pitch = Math.max(0.25, Math.min(1.35, ((90 - tilt) * Math.PI) / 180));
        const distance = Math.max(camDistance, 45 - Math.min(maxZoom, 21));
        const currentH = headingRef.current;
        camera.position.set(
          target.x + Math.sin((currentH * Math.PI) / 180) * distance * Math.cos(pitch),
          target.y + distance * Math.sin(pitch),
          target.z + Math.cos((currentH * Math.PI) / 180) * distance * Math.cos(pitch),
        );
        camera.lookAt(target);
      };
      updateCamera();

      // ── Interactive Mouse Orbit & Drag Controls ──
      let isDragging = false;
      let startX = 0;
      let startY = 0;

      const handlePointerDown = (e: PointerEvent) => {
        if (e.button !== 0) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        renderer.domElement.style.cursor = "grabbing";
        setAutoRotate(false);
      };

      const handlePointerMove = (e: PointerEvent) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        startX = e.clientX;
        startY = e.clientY;

        const nextH = headingRef.current - dx * 0.45;
        setNormalizedHeading(nextH, false);
        setTilt((curTilt) => Math.max(20, Math.min(78, curTilt + dy * 0.25)));
        updateCamera();
      };

      const handlePointerUp = () => {
        if (!isDragging) return;
        isDragging = false;
        renderer.domElement.style.cursor = "grab";
      };

      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const delta = Math.sign(e.deltaY);
        setMaxZoom((z) => Math.max(14, Math.min(22, z - delta)));
        updateCamera();
      };

      const domElem = renderer.domElement;
      domElem.addEventListener("pointerdown", handlePointerDown);
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      domElem.addEventListener("wheel", handleWheel, { passive: false });

      // Resize handler
      const resize = () => {
        const w = Math.max(root.clientWidth || window.innerWidth, 1);
        const h = Math.max(root.clientHeight || window.innerHeight, 1);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      observer = new ResizeObserver(resize);
      observer.observe(root);
      resize();

      const renderFrame = () => {
        if (disposed) return;
        renderer.render(scene, camera);
        animationFrame = requestAnimationFrame(renderFrame);
      };
      renderFrame();
      setMapReady(true);
    }).catch(() => {
      setMapError("GPU 3D unavailable; CSS 3D scene active.");
      setMapRenderer("css-fallback");
      setMapReady(true);
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      observer?.disconnect();
      threeSceneRef.current?.renderer?.dispose?.();
      threeSceneRef.current = null;
    };
  }, [mapRenderer, JSON.stringify(roofPolygons), center?.lat, center?.lng, zoom, className]);

  useEffect(() => {
    if (className.includes("hidden") || !threeSceneRef.current) return;
    const { renderer, camera } = threeSceneRef.current;
    const root = threeRootRef.current;
    if (root && renderer && camera) {
      const w = Math.max(root.clientWidth || window.innerWidth, 1);
      const h = Math.max(root.clientHeight || window.innerHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
  }, [className]);

  const style: CSSProperties = { pointerEvents: (mapRenderer === "photorealistic-3d" || mapRenderer === "three-fallback") ? "auto" : "none", width: "100%", height: "100%" };
  return (
    <div
      ref={rootRef}
      className={`${className} w-full h-full`}
      style={style}
      aria-label="Interactive 3D satellite map"
      data-tour="orbital-globe"
      data-profile-confidence={profileConfidence ?? undefined}
      data-profile-applied={profileApplied}
      data-profile-tilt={tilt}
      data-profile-max-zoom={maxZoom}
      data-map-renderer={mapRenderer}
    >
      <div ref={mapRootRef} className="absolute inset-0 w-full h-full" style={{ width: "100%", height: "100%" }} />
      {mapRenderer === "css-fallback" && (
        <div className="absolute inset-0 z-0 overflow-hidden bg-[#08111d]" style={{ perspective: "900px" }}>
          <div
            data-testid="css-3d-scene"
            className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2"
            style={{
              transformStyle: "preserve-3d",
              transform: `translate(-50%, -50%) rotateX(${Math.max(18, Math.min(62, tilt))}deg) rotateZ(${heading}deg)`,
              background: "linear-gradient(90deg, transparent 49%, rgba(96,165,250,.22) 50%, transparent 51%), linear-gradient(0deg, transparent 49%, rgba(96,165,250,.22) 50%, transparent 51%)",
              backgroundSize: "3rem 3rem",
              border: "1px solid rgba(125,211,252,.35)",
              boxShadow: "0 0 80px rgba(14,165,233,.18) inset",
            }}
          >
            {Array.from({ length: 18 }, (_, index) => {
              const x = (index % 6) * 16 + 4;
              const y = Math.floor(index / 6) * 27 + 8;
              const height = 28 + (index % 5) * 10;
              return (
                <div
                  key={index}
                  className="absolute w-12 border border-slate-300/30 bg-slate-400/70 shadow-[0_8px_12px_rgba(0,0,0,.35)]"
                  style={{ left: `${x}%`, top: `${y}%`, height: `${height}px`, transform: `translateZ(${height / 2}px)` }}
                />
              );
            })}
          </div>
        </div>
      )}
      <div ref={threeRootRef} className={mapRenderer === "three-fallback" ? "absolute inset-0 z-[1]" : "hidden"} />
      {mapRenderer === "three-fallback" && !hasValidRoof && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none p-4">
          <div className="pointer-events-auto max-w-sm rounded-2xl border border-white/10 bg-[#0c1420]/95 p-6 text-center backdrop-blur-md shadow-2xl">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/20 text-[#FF6600]">
              <Layers className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">No Rooftop Boundary Traced</h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-5">
              Draw your rooftop perimeter on the 2D Satellite Map first. Your custom 3D building and solar array will generate here automatically.
            </p>
            <button
              type="button"
              onClick={onSwitchTo2D}
              className="w-full rounded-xl bg-gradient-to-r from-[#FF6600] to-amber-500 py-2.5 px-4 text-xs font-bold text-black shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              Open 2D Satellite Map
            </button>
          </div>
        </div>
      )}
      {mapError && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[calc(100%-1.5rem)] rounded border border-amber-300/30 bg-black/75 px-2 py-1 font-mono text-[10px] text-amber-100">
          {mapError}
        </div>
      )}
      <div data-tour="3d-rotation" className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md border border-white/15 bg-black/75 p-1 backdrop-blur-sm pointer-events-auto">
        <button
          type="button"
          aria-label="Rotate 45 degrees counterclockwise"
          title="Rotate counterclockwise"
          onClick={() => rotate(-45)}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-white/80 transition hover:bg-white/15 hover:text-white"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Upload 3D training telemetry"
          title={telemetryUploading ? "Uploading telemetry" : `${telemetryCount} samples · ${telemetrySummary.comparedContexts} compared contexts`}
          onClick={async () => {
            setTelemetryUploading(true);
            await uploadTelemetryRows();
            setTelemetryUploading(false);
          }}
          disabled={telemetryCount === 0 || telemetryUploading}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-white/80 transition hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Upload className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Calibrate 3D rendering profiles"
          title={calibrationActive ? "3D calibration in progress" : "Measure alternative 3D rendering profiles"}
          onClick={startCalibration}
          disabled={!mapReady || calibrationActive}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-white/80 transition hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Gauge className="h-4 w-4" />
        </button>
        <output
          aria-label="3D telemetry promotion readiness"
          title={`${telemetrySummary.optimizedContexts}/64 runtime contexts · ${telemetrySummary.comparedContexts}/${telemetrySummary.requiredComparedContexts} compared contexts`}
          className="min-w-9 text-center font-mono text-[10px] text-white/70"
        >
          {telemetrySummary.readyForPromotion ? "READY" : `${telemetrySummary.comparedContexts}/${telemetrySummary.requiredComparedContexts}`}
        </output>
        <output
          aria-label="3D renderer status"
          title={mapRenderer === "photorealistic-3d" ? "Photorealistic 3D camera active" : mapRenderer === "three-fallback" || mapRenderer === "css-fallback" ? "Local interactive 3D scene active" : "3D renderer unavailable"}
          className="sr-only"
        >
          {mapRenderer}
        </output>
        <output aria-label="Map heading" data-heading={heading} className="min-w-12 text-center font-mono text-[10px] text-white/70">
          {heading}°
        </output>
        <button
          type="button"
          aria-label={autoRotate ? "Pause automatic map rotation" : "Resume automatic map rotation"}
          title={autoRotate ? "Pause rotation" : "Resume rotation"}
          onClick={() => setAutoRotate((value) => !value)}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-white/80 transition hover:bg-white/15 hover:text-white"
        >
          {autoRotate ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          type="button"
          aria-label="Rotate 45 degrees clockwise"
          title="Rotate clockwise"
          onClick={() => rotate(45)}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-white/80 transition hover:bg-white/15 hover:text-white"
        >
          <RotateCw className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Reset map rotation"
          title="Reset map rotation"
          onClick={() => { setAutoRotate(false); setNormalizedHeading(0, false); }}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-white/80 transition hover:bg-white/15 hover:text-white"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Download 3D training telemetry"
          title={`Download ${telemetryCount} local telemetry sample${telemetryCount === 1 ? "" : "s"}`}
          onClick={() => downloadTelemetryRows()}
          disabled={telemetryCount === 0}
          className="inline-flex h-8 items-center justify-center gap-1 rounded px-2 text-white/80 transition hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="h-4 w-4" />
          <span className="font-mono text-[10px]">{telemetryCount}</span>
        </button>
      </div>
    </div>
  );
}

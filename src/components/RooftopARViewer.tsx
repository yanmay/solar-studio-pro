import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import CameraControls from "camera-controls";
import { Box, Camera, Maximize2, RotateCcw, RotateCw, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { track } from "@/lib/analytics";
import type { ObstructionDetection } from "@/lib/obstruction-geometry";

CameraControls.install({ THREE });

interface Props {
  installedKw: number;
  panelCount: number;
  /** Optional drawn area — shapes the roof. If omitted, derived from panel count. */
  areaM2?: number;
  /** Roof/panel parameters selected by the scan workflow. */
  tiltDeg?: number;
  azimuthDeg?: number;
  orientation?: "portrait" | "landscape";
  roofPolygons?: Array<Array<{ lat: number; lng: number }>>;
  panelFootprints?: Array<Array<{ lat: number; lng: number }>>;
  obstructions?: ObstructionDetection[];
  analysisStatus?: "complete" | "unavailable" | "failed";
  analysisMessage?: string;
}

export function localizeRoofPolygons(polygons: Array<Array<{ lat: number; lng: number }>>) {
  const validPolygons = polygons.filter((polygon) => polygon.length >= 3);
  const points = validPolygons.flat();
  if (points.length < 3) return null;
  const refLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const refLng = points.reduce((sum, point) => sum + point.lng, 0) / points.length;
  const lngMeters = 111320 * Math.cos((refLat * Math.PI) / 180);
  const local = validPolygons
    .map((polygon) => polygon.map((point) => [
      (point.lng - refLng) * lngMeters,
      (point.lat - refLat) * 111320,
    ] as [number, number]))
    .filter((polygon) => polygon.length >= 3);
  if (!local.length) return null;
  const bounds = local.flat();
  const minX = Math.min(...bounds.map(([x]) => x));
  const maxX = Math.max(...bounds.map(([x]) => x));
  const minY = Math.min(...bounds.map(([, y]) => y));
  const maxY = Math.max(...bounds.map(([, y]) => y));
  const extent = Math.max(maxX - minX, maxY - minY, 1);
  const scale = 8 / extent;
  return {
    polygons: local.map((polygon) => polygon.map(([x, y]) => [(x - (minX + maxX) / 2) * scale, (y - (minY + maxY) / 2) * scale] as [number, number])),
    width: Math.max(3, (maxX - minX) * scale),
    depth: Math.max(3, (maxY - minY) * scale),
    project: (point: { lat: number; lng: number }): [number, number] => [
      ((point.lng - refLng) * lngMeters - (minX + maxX) / 2) * scale,
      ((point.lat - refLat) * 111320 - (minY + maxY) / 2) * scale,
    ],
  };
}

function pointInPolygon([x, y]: [number, number], polygon: [number, number][]) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [xi, yi] = polygon[index];
    const [xj, yj] = polygon[previous];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Interactive 3D preview of the user's rooftop with solar panels arrayed on it.
 * Offers a "View in AR" button that launches a WebXR AR session on compatible
 * devices (Android Chrome + WebXR-enabled browsers).
 */
const RooftopARViewer = ({
  installedKw,
  panelCount,
  areaM2,
  tiltDeg = 15,
  azimuthDeg = 180,
  orientation = "portrait",
  roofPolygons = [],
  panelFootprints = [],
  obstructions = [],
  analysisStatus = "unavailable",
  analysisMessage,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [orbitHeading, setOrbitHeading] = useState(0);
  const [arSupported, setArSupported] = useState(false);
  const [sceneFallback, setSceneFallback] = useState(false);
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRootRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const xrSessionRef = useRef<XRSession | null>(null);
  const orbitHeadingRef = useRef(0);

  const setOrbit = (nextHeading: number) => {
    const normalized = ((nextHeading % 360) + 360) % 360;
    orbitHeadingRef.current = normalized;
    setOrbitHeading(normalized);
    sceneRootRef.current?.rotation.set(
      sceneRootRef.current.rotation.x,
      THREE.MathUtils.degToRad((((azimuthDeg % 360) + 360) % 360) - 180 + normalized),
      sceneRootRef.current.rotation.z,
    );
  };

  useEffect(() => {
    if (!open) setOrbit(0);
  }, [open]);

  useEffect(() => {
    if (!open || !sceneFallback) return;
    const interval = window.setInterval(() => setOrbit(orbitHeadingRef.current + 1), 80);
    return () => window.clearInterval(interval);
  }, [open, sceneFallback]);

  // Check WebXR AR support on mount
  useEffect(() => {
    const nav = navigator as unknown as { xr?: { isSessionSupported?: (m: string) => Promise<boolean> } };
    nav.xr?.isSessionSupported?.("immersive-ar")
      .then((ok) => setArSupported(!!ok))
      .catch(() => setArSupported(false));
  }, []);

  // Build + render Three.js scene when dialog opens
  useEffect(() => {
    if (!open) return;
    let cleanup: (() => void) | null = null;
    let cancelled = false;

    const init = () => {
      const mount = mountRef.current;
      if (!mount || cancelled) return;
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (width < 10 || height < 10) {
        // Radix Dialog still animating in — retry next frame
        requestAnimationFrame(init);
        return;
      }
      try {
        cleanup = buildScene(mount, width, height);
        setSceneFallback(false);
      } catch {
        setSceneFallback(true);
      }
    };
    requestAnimationFrame(init);
    return () => {
      cancelled = true;
      cleanup?.();
      setSceneFallback(false);
    };

    function buildScene(mount: HTMLDivElement, width: number, height: number) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.xr.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setClearColor(0x87ceeb, 1);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x87ceeb, 8, 30);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200);
    camera.position.set(5, 6, 8);

    const controls = new CameraControls(camera, renderer.domElement);
    controls.dampingFactor = 0.1;
    controls.minDistance = 3;
    controls.maxDistance = 20;
    controls.setTarget(0, 0.5, 0, false);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xfff5d9, 1.8);
    sun.position.set(4, 10, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -8;
    sun.shadow.camera.right = 8;
    sun.shadow.camera.top = 8;
    sun.shadow.camera.bottom = -8;
    scene.add(sun);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Ground (grass)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: 0x66bb6a, roughness: 0.85 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Root group we can move around in AR
    const root = new THREE.Group();
    sceneRootRef.current = root;
    scene.add(root);

    // Use the surveyed polygon when available; old scans fall back to a square footprint.
    const localizedRoof = localizeRoofPolygons(roofPolygons);
    if (!localizedRoof) {
      setSceneFallback(true);
      return;
    }
    const side = Math.max(localizedRoof.width, localizedRoof.depth) / 2;
    const footprintWidth = localizedRoof?.width ?? side * 2;
    const footprintDepth = localizedRoof?.depth ?? side * 2;
    const houseH = 2.4;

    // House walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf4e6c9, roughness: 0.9 });
    const createFootprint = (depth: number) => {
      const polygons = localizedRoof.polygons;
      const shapes = polygons.map((polygon) => {
        const shape = new THREE.Shape();
        shape.moveTo(polygon[0][0], polygon[0][1]);
        polygon.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
        shape.closePath();
        return shape;
      });
      return new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false });
    };
    const house = new THREE.Mesh(createFootprint(houseH), wallMat);
    house.rotation.x = Math.PI / 2;
    house.position.y = houseH;
    house.castShadow = true;
    house.receiveShadow = true;
    root.add(house);

    const roofTilt = Math.max(0, Math.min(60, tiltDeg));
    const roofAzimuth = ((azimuthDeg % 360) + 360) % 360;
    root.rotation.y = THREE.MathUtils.degToRad(roofAzimuth - 180 + orbitHeadingRef.current);

    // Roof slab follows the selected roof pitch.
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.95 });
    const roofAssembly = new THREE.Group();
    roofAssembly.position.y = houseH;
    roofAssembly.rotation.x = THREE.MathUtils.degToRad(-roofTilt);
    root.add(roofAssembly);
    const roof = new THREE.Mesh(createFootprint(0.15), roofMat);
    // Extrude down from the roof plane so the slab and panels share the same top surface.
    roof.rotation.x = Math.PI / 2;
    roof.position.y = 0;
    roof.castShadow = true;
    roof.receiveShadow = true;
    roofAssembly.add(roof);

    obstructions.forEach((obstruction) => {
      const footprint = obstruction.footprint.map((point) => localizedRoof.project(point));
      if (footprint.length < 3) return;
      const shape = new THREE.Shape();
      shape.moveTo(footprint[0][0], -footprint[0][1]);
      footprint.slice(1).forEach(([x, y]) => shape.lineTo(x, -y));
      shape.closePath();
      const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.1, obstruction.heightM), bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xd14d3f, transparent: true, opacity: 0.9 }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.18;
      roofAssembly.add(mesh);
    });

    // Solar panels grid — arrange `panelCount` 1.6×1m panels
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x1a3a7a,
      metalness: 0.3,
      roughness: 0.35,
      envMapIntensity: 0.8,
    });
    const panelW = orientation === "portrait" ? 1.0 : 1.6;
    const panelL = orientation === "portrait" ? 1.6 : 1.0;
    const gap = 0.08;
    const roofW = footprintWidth - 0.4;
    const roofL = footprintDepth - 0.4;
    const localizedPanels = localizedRoof
      ? panelFootprints
        .map((footprint) => footprint.map((point) => localizedRoof.project(point)))
        .filter((footprint) => footprint.length >= 3)
      : [];
    const cols = Math.max(1, Math.floor((roofW + gap) / (panelW + gap)));
    const rows = Math.max(1, Math.ceil(panelCount / cols));
    let placed = 0;
    const totalRows = Math.min(rows, Math.floor((roofL + gap) / (panelL + gap)));
    const createPanel = (corners: [number, number][], px: number, pz: number) => {
      const grid = new THREE.Group();
      const shape = new THREE.Shape();
      shape.moveTo(corners[0][0], -corners[0][1]);
      corners.slice(1).forEach(([x, y]) => shape.lineTo(x, -y));
      shape.closePath();
      const panel = new THREE.Mesh(new THREE.ShapeGeometry(shape), panelMat);
      panel.rotation.x = -Math.PI / 2;
      panel.castShadow = true;
      grid.add(panel);
      const frame = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(corners.map(([x, y]) => new THREE.Vector3(x, -y, 0.01))),
        new THREE.LineBasicMaterial({ color: 0xdddddd }),
      );
      frame.rotation.x = -Math.PI / 2;
      grid.add(frame);
      grid.position.set(px, 0.2, pz);
      roofAssembly.add(grid);
    };
    if (localizedPanels.length) {
      localizedPanels.forEach((corners) => {
        const center = corners.reduce(([x, y], [cx, cy]) => [x + cx, y + cy], [0, 0] as [number, number]);
        createPanel(corners.map(([x, y]) => [x - center[0] / corners.length, y - center[1] / corners.length] as [number, number]), center[0] / corners.length, center[1] / corners.length);
        placed++;
      });
    } else for (let r = 0; r < totalRows && placed < panelCount; r++) {
      for (let c = 0; c < cols && placed < panelCount; c++) {
        const px = -roofW / 2 + c * (panelW + gap) + panelW / 2;
        const pz = -roofL / 2 + r * (panelL + gap) + panelL / 2;
        const panelCorners: [number, number][] = [
          [px - panelW / 2, pz - panelL / 2],
          [px + panelW / 2, pz - panelL / 2],
          [px + panelW / 2, pz + panelL / 2],
          [px - panelW / 2, pz + panelL / 2],
        ];
        if (localizedRoof && !localizedRoof.polygons.some((polygon) => panelCorners.every((corner) => pointInPolygon(corner, polygon)))) continue;
        createPanel([
          [-panelW / 2, -panelL / 2],
          [panelW / 2, -panelL / 2],
          [panelW / 2, panelL / 2],
          [-panelW / 2, panelL / 2],
        ], px, pz);
        placed++;
      }
    }

    // Small "KW label" sprite above the house
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(255,180,0,0.95)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 72px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${installedKw} kWp · ${panelCount} panels`, canvas.width / 2, canvas.height / 2);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
    sprite.position.set(0, houseH + 2, 0);
    sprite.scale.set(4, 1, 1);
    root.add(sprite);

    // Animation loop
    const clock = new THREE.Clock();
    let animating = true;
    renderer.setAnimationLoop(() => {
      if (!animating) return;
      root.rotation.y += 0.003;
      controls.update(clock.getDelta());
      renderer.render(scene, camera);
    });

    // Resize
    const onResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    return () => {
      animating = false;
      ro.disconnect();
      try { xrSessionRef.current?.end(); } catch { /* ignore */ }
      renderer.setAnimationLoop(null);
      controls.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
    }
  }, [open, installedKw, panelCount, areaM2, tiltDeg, azimuthDeg, orientation, roofPolygons, panelFootprints, obstructions]);

  const launchAR = async () => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    track("AR Launched");
    try {
      const nav = navigator as unknown as { xr?: { requestSession: (m: string, opts?: object) => Promise<XRSession> } };
      const session = await nav.xr!.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["dom-overlay"],
      });
      xrSessionRef.current = session;
      await renderer.xr.setSession(session);
      session.addEventListener("end", () => { xrSessionRef.current = null; });
    } catch (err) {
      console.error("AR session failed:", err);
    }
  };

  return (
    <>
      <div
        className="bg-[#0A0A0A]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 mb-8 text-white shadow-2xl relative overflow-hidden group hover:border-violet-500/40 transition-all duration-300"
        role="region"
        aria-label="AR rooftop preview"
        data-tilt-deg={Math.max(0, Math.min(60, tiltDeg))}
        data-azimuth-deg={((azimuthDeg % 360) + 360) % 360}
        data-panel-orientation={orientation}
        data-roof-polygon-count={roofPolygons.filter((polygon) => polygon.length >= 3).length}
        data-panel-footprint-count={panelFootprints.filter((polygon) => polygon.length >= 3).length}
      >
        {analysisStatus !== "complete" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-6 text-center" role="status">
            <p className="max-w-sm text-sm text-white/80">{analysisMessage || "3D obstruction analysis is unavailable. No inferred geometry is shown."}</p>
          </div>
        )}
        {/* Top ambient hairline */}
        <div
          className="absolute top-0 left-0 right-0 h-px rounded-t-3xl opacity-60 pointer-events-none"
          style={{ background: "linear-gradient(90deg, transparent, rgba(167,139,250,0.5), transparent)" }}
          aria-hidden="true"
        />

        <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Box className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white tracking-tight">Interactive 3D Rooftop Simulation</h3>
              <p className="text-xs text-white/50 font-light mt-0.5 leading-relaxed">
                3D array preview of your {installedKw} kWp ({panelCount} panels) geometry{arSupported ? " — WebXR AR available on this device" : ""}.
              </p>
            </div>
          </div>
          <button
            onClick={() => { setOpen(true); track("3D Preview Opened"); }}
            className="shrink-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:brightness-110 text-white text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-xl active:scale-95 transition-all flex items-center gap-2 border-none shadow-lg shadow-violet-500/20 cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" /> Open 3D Preview
          </button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden h-[85vh] sm:h-[600px] bg-[#0A0A0A] border border-white/15 rounded-3xl text-white backdrop-blur-3xl shadow-2xl">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-white/10">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-bold text-white">
              <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center">
                <Box className="w-4 h-4" />
              </div>
              <span>3D Spatial Rooftop Simulation</span>
            </DialogTitle>
            <DialogDescription className="text-xs font-mono text-white/40">
              Drag to rotate · pinch / scroll to zoom · {Math.max(0, Math.min(60, tiltDeg))}° tilt · {orientation}
            </DialogDescription>
          </DialogHeader>
          <div ref={mountRef} className="flex-1 w-full h-full min-h-[400px] bg-slate-950 relative">
            {sceneFallback && (
              <div
                data-testid="rooftop-css-3d-fallback"
                className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_50%_35%,#304866,#07111f_70%)]"
                style={{ perspective: "900px" }}
              >
                <div
                  className="absolute left-1/2 top-1/2 h-56 w-72 -translate-x-1/2 -translate-y-1/2 border-2 border-amber-200/60 bg-slate-500/80 shadow-[0_30px_50px_rgba(0,0,0,.45)]"
                  style={{
                    transformStyle: "preserve-3d",
                    transform: `translate(-50%, -50%) rotateX(${Math.max(18, Math.min(62, tiltDeg))}deg) rotateZ(${orbitHeading}deg)`,
                  }}
                >
                  {Array.from({ length: Math.max(1, Math.min(panelCount, 18)) }, (_, index) => (
                    <div
                      key={index}
                      className="absolute h-10 w-16 border border-cyan-100/60 bg-blue-900/85"
                      style={{ left: `${8 + (index % 4) * 23}%`, top: `${10 + Math.floor(index / 4) * 22}%`, transform: "translateZ(18px)" }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-xl border border-white/15 bg-black/55 px-2 py-2 backdrop-blur-md">
              <button
                onClick={() => setOrbit(orbitHeading - 45)}
                className="w-9 h-9 rounded-lg border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Rotate rooftop 45 degrees counterclockwise"
                title="Rotate rooftop 45 degrees counterclockwise"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <div className="min-w-14 text-center" role="status" aria-label="Rooftop heading" data-heading={orbitHeading}>
                <span className="text-[10px] font-mono text-white/50">VIEW</span>
                <span className="block text-xs font-mono text-white">{orbitHeading}°</span>
              </div>
              <button
                onClick={() => setOrbit(orbitHeading + 45)}
                className="w-9 h-9 rounded-lg border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Rotate rooftop 45 degrees clockwise"
                title="Rotate rooftop 45 degrees clockwise"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setOrbit(0)}
                className="w-9 h-9 rounded-lg border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Reset rooftop rotation"
                title="Reset rooftop rotation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
            {arSupported && (
              <button
                onClick={launchAR}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white text-black font-mono font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 active:scale-95 transition-all border-none cursor-pointer hover:bg-neutral-100"
              >
                <Camera className="w-4 h-4 text-violet-600" /> View In WebXR AR
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white/80 hover:text-white hover:bg-black flex items-center justify-center shadow-lg transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RooftopARViewer;

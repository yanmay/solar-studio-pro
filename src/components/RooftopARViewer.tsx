import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import CameraControls from "camera-controls";
import { Box, Camera, Maximize2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { track } from "@/lib/analytics";

CameraControls.install({ THREE });

interface Props {
  installedKw: number;
  panelCount: number;
  /** Optional drawn area — shapes the roof. If omitted, derived from panel count. */
  areaM2?: number;
}

/**
 * Interactive 3D preview of the user's rooftop with solar panels arrayed on it.
 * Offers a "View in AR" button that launches a WebXR AR session on compatible
 * devices (Android Chrome + WebXR-enabled browsers).
 */
const RooftopARViewer = ({ installedKw, panelCount, areaM2 }: Props) => {
  const [open, setOpen] = useState(false);
  const [arSupported, setArSupported] = useState(false);
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRootRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const xrSessionRef = useRef<XRSession | null>(null);

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
      cleanup = buildScene(mount, width, height);
    };
    requestAnimationFrame(init);
    return () => {
      cancelled = true;
      cleanup?.();
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

    // Size the house footprint from the drawn area (square-ish)
    const side = Math.max(3, Math.sqrt(Math.max(25, areaM2 ?? panelCount * 2)) / 2);
    const houseH = 2.4;

    // House walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf4e6c9, roughness: 0.9 });
    const house = new THREE.Mesh(new THREE.BoxGeometry(side * 2, houseH, side * 2), wallMat);
    house.position.y = houseH / 2;
    house.castShadow = true;
    house.receiveShadow = true;
    root.add(house);

    // Roof slab (flat — so we can array panels on top)
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.95 });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(side * 2 + 0.2, 0.15, side * 2 + 0.2), roofMat);
    roof.position.y = houseH + 0.075;
    roof.castShadow = true;
    roof.receiveShadow = true;
    root.add(roof);

    // Solar panels grid — arrange `panelCount` 1.6×1m panels
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x1a3a7a,
      metalness: 0.3,
      roughness: 0.35,
      envMapIntensity: 0.8,
    });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.6, roughness: 0.3 });
    const panelW = 1.6;
    const panelL = 1.0;
    const gap = 0.08;
    const roofW = side * 2 - 0.4;
    const roofL = side * 2 - 0.4;
    const cols = Math.max(1, Math.floor((roofW + gap) / (panelW + gap)));
    const rows = Math.max(1, Math.ceil(panelCount / cols));
    let placed = 0;
    const totalRows = Math.min(rows, Math.floor((roofL + gap) / (panelL + gap)));
    for (let r = 0; r < totalRows && placed < panelCount; r++) {
      for (let c = 0; c < cols && placed < panelCount; c++) {
        const px = -roofW / 2 + c * (panelW + gap) + panelW / 2;
        const pz = -roofL / 2 + r * (panelL + gap) + panelL / 2;
        const grid = new THREE.Group();
        const panel = new THREE.Mesh(new THREE.BoxGeometry(panelW, 0.05, panelL), panelMat);
        panel.castShadow = true;
        grid.add(panel);
        // Frame
        const frame = new THREE.Mesh(new THREE.BoxGeometry(panelW + 0.04, 0.07, panelL + 0.04), frameMat);
        frame.position.y = -0.005;
        grid.add(frame);
        // Subtle cell lines
        const cellTex = new THREE.TextureLoader();
        grid.position.set(px, houseH + 0.2, pz);
        // Tilt 15° toward south (positive z here)
        grid.rotation.x = -15 * (Math.PI / 180);
        root.add(grid);
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
  }, [open, installedKw, panelCount, areaM2]);

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
      <div className="bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5 border border-violet-500/20 rounded-2xl p-5 sm:p-6 mb-8" role="region" aria-label="AR rooftop preview">
        <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
              <Box className="w-5 h-5 text-violet-500" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-medium text-sunpower-text-primary">See it on your roof</h3>
              <p className="text-xs text-sunpower-text-muted mt-0.5">
                Interactive 3D preview of your {installedKw} kWp system{arSupported ? " — launch AR on this device" : ""}.
              </p>
            </div>
          </div>
          <button
            onClick={() => { setOpen(true); track("3D Preview Opened"); }}
            className="shrink-0 bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium px-4 py-2 rounded-lg active:scale-95 transition-all flex items-center gap-2"
          >
            <Maximize2 className="w-4 h-4" /> Open 3D preview
          </button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden h-[85vh] sm:h-[600px]">
          <DialogHeader className="px-5 pt-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Box className="w-5 h-5 text-violet-500" /> 3D Rooftop Preview
            </DialogTitle>
            <DialogDescription>
              Drag to rotate · pinch / scroll to zoom. Panels scaled 1.6×1 m with 15° tilt.
            </DialogDescription>
          </DialogHeader>
          <div ref={mountRef} className="flex-1 w-full h-full min-h-[400px] bg-sky-200 relative">
            {arSupported && (
              <button
                onClick={launchAR}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white text-violet-600 font-medium px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 active:scale-95 transition-all"
              >
                <Camera className="w-4 h-4" /> View in AR
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow"
              aria-label="Close"
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

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";
import CameraControls from "camera-controls";

/**
 * 3D Earth Globe — faithful port of cheeaun/3d-earth
 *
 * Scene structure (matching the original):
 *   - Earth: SphereGeometry(200, 50, 50) + MeshPhongMaterial with satellite texture
 *   - Clouds: same geometry + MeshLambertMaterial with alpha map (child of earth)
 *   - Stars: SphereGeometry(1000) + MeshBasicMaterial(side: BackSide) with star field texture
 *   - Light: DirectionalLight tracking camera position
 *   - Camera: PerspectiveCamera(80, aspect, 1, 2000), initial z=500
 *   - CameraControls: min 220, max 520, initial tilt rotate(0, -1)
 */

// Install camera-controls with Three.js submodule
CameraControls.install({ THREE });

// ─── Imperative handle exposed to parent ──────────────────────
export interface Globe3DHandle {
  /** Smoothly move camera to a target distance */
  dollyTo: (distance: number, animate?: boolean) => void;
}

// ─── Props ────────────────────────────────────────────────────
interface Globe3DProps {
  className?: string;
  /** Called every frame with camera distance from earth center and current lat/lng focus */
  onDistanceChange?: (distance: number, lat?: number, lng?: number) => void;
  /** When true, pause auto-rotation */
  stopRotation?: boolean;
}

const Globe3D = forwardRef<Globe3DHandle, Globe3DProps>(
  ({ className = "", onDistanceChange, stopRotation = false }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const distanceCbRef = useRef(onDistanceChange);
    const stopRotRef = useRef(stopRotation);
    const controlsRef = useRef<CameraControls | null>(null);

    // Keep refs current without re-running the effect
    useEffect(() => { distanceCbRef.current = onDistanceChange; }, [onDistanceChange]);
    useEffect(() => { stopRotRef.current = stopRotation; }, [stopRotation]);

    // Expose imperative methods to parent via ref
    useImperativeHandle(ref, () => ({
      dollyTo: (distance: number, animate = true) => {
        controlsRef.current?.dollyTo(distance, animate);
      },
    }));

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      // ── Renderer ────────────────────────────────────────────
      const dpr = Math.min(window.devicePixelRatio, 2);
      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
      });
      renderer.setPixelRatio(dpr);
      renderer.setSize(container.clientWidth, container.clientHeight);
      container.appendChild(renderer.domElement);

      // ── Camera (matching original: FOV 80, z=500) ───────────
      const camera = new THREE.PerspectiveCamera(
        80,
        container.clientWidth / container.clientHeight,
        1,
        2000,
      );
      camera.position.z = 500;

      // ── Camera Controls ─────────────────────────────────────
      const clock = new THREE.Clock();
      const cameraControls = new CameraControls(camera, renderer.domElement);
      controlsRef.current = cameraControls;

      // Distance limits — replaces the original dolly hack
      cameraControls.minDistance = 220;  // don't let camera clip into sphere
      cameraControls.maxDistance = 520;  // deep space view

      // Smooth, responsive zoom feel
      cameraControls.dampingFactor = 0.12;
      cameraControls.draggingDampingFactor = 0.18;
      cameraControls.dollySpeed = 1.0;        // full speed scroll zoom
      cameraControls.azimuthRotateSpeed = 0.5; // slower rotate for precision
      cameraControls.polarRotateSpeed = 0.5;
      cameraControls.truckSpeed = 0;           // no panning — globe only
      cameraControls.infinityDolly = false;
      cameraControls.dollyToCursor = false;

      // Initial tilt: rotate(0, -1, true) — tilt to show India well
      cameraControls.rotate(0, -1, true);
      cameraControls.update(0);

      // ── Scene ───────────────────────────────────────────────
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000000);

      // ── Texture Loader ──────────────────────────────────────
      const loader = new THREE.TextureLoader();

      // ── Earth ───────────────────────────────────────────────
      const earthGeometry = new THREE.SphereGeometry(200, 50, 50);
      const earthMaterial = new THREE.MeshPhongMaterial({ shininess: 5 });
      const earth = new THREE.Mesh(earthGeometry, earthMaterial);
      scene.add(earth);

      // Load earth satellite texture
      loader.load("/earth-blue-marble.jpg", (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        earthMaterial.map = texture;
        earthMaterial.needsUpdate = true;
      });

      // ── Clouds (child of earth so it rotates with it) ───────
      const cloudGeometry = new THREE.SphereGeometry(201, 50, 50);
      const cloudMaterial = new THREE.MeshLambertMaterial({
        opacity: 0.8,
        transparent: true,
      });
      const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
      cloud.visible = true;
      earth.add(cloud);

      loader.load("/clouds_2048.jpg", (texture) => {
        cloudMaterial.alphaMap = texture;
        cloudMaterial.needsUpdate = true;
      });

      // ── Stars (large inverted sphere with texture) ──────────
      const starsGeometry = new THREE.SphereGeometry(1000, 32, 32);
      const starsMaterial = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
      const stars = new THREE.Mesh(starsGeometry, starsMaterial);
      scene.add(stars);

      loader.load("/galaxystarfield.png", (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        starsMaterial.map = texture;
        starsMaterial.needsUpdate = true;
      });

      // ── Light (follows camera, matching original) ───────────
      const light = new THREE.DirectionalLight(0xffffff, 3);
      light.target = earth;
      scene.add(light);

      // ── Stop rotation on drag, resume on release ────────────
      let userDragging = false;
      const onPointerDown = () => { userDragging = true; };
      const onPointerUp = () => { userDragging = false; };
      container.addEventListener("pointerdown", onPointerDown);
      container.addEventListener("pointerup", onPointerUp);
      container.addEventListener("pointercancel", onPointerUp);

      // ── Resize handler ──────────────────────────────────────
      const handleResize = () => {
        if (!container) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", handleResize);

      // ── Cinematic entry: zoom from 500 → 380 ────────────────
      cameraControls.dollyTo(380, true);

      // ── Render loop (matching cheeaun exactly) ──────────────
      let animating = true;

      const animate = () => {
        if (!animating) return;
        requestAnimationFrame(animate);

        const delta = clock.getDelta();
        cameraControls.update(delta);

        // Auto-rotate (original: earth +=0.001, stars -=0.0005)
        if (!userDragging && !stopRotRef.current) {
          earth.rotation.y += 0.001;
          stars.rotation.y -= 0.0005;
        }

        // Light follows camera (original: light.position.copy(camera.position))
        light.position.copy(camera.position);

        // Calculate exact lat/lng under the crosshair
        let centerLat: number | undefined;
        let centerLng: number | undefined;
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const intersects = raycaster.intersectObject(earth);
        
        if (intersects.length > 0) {
          // Get intersection point and convert to Earth's local space (accounting for its rotation)
          const localP = earth.worldToLocal(intersects[0].point.clone());
          const radius = 200; // Same as SphereGeometry
          
          // Spherical inverse mapping for Three.js SphereGeometry
          const lat = Math.asin(localP.y / Math.max(radius, Number.EPSILON)) * (180 / Math.PI);
          const lng = Math.atan2(localP.x, localP.z) * (180 / Math.PI);
          
          centerLat = lat;
          centerLng = lng;
        }

        // Report distance and center coordinates to parent
        distanceCbRef.current?.(cameraControls.distance, centerLat, centerLng);

        renderer.render(scene, camera);
      };

      animate();

      // ── Cleanup ─────────────────────────────────────────────
      return () => {
        animating = false;
        controlsRef.current = null;
        window.removeEventListener("resize", handleResize);
        container.removeEventListener("pointerdown", onPointerDown);
        container.removeEventListener("pointerup", onPointerUp);
        container.removeEventListener("pointercancel", onPointerUp);
        cameraControls.dispose();
        earthGeometry.dispose();
        earthMaterial.dispose();
        cloudGeometry.dispose();
        cloudMaterial.dispose();
        starsGeometry.dispose();
        starsMaterial.dispose();
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      };
    }, []);

    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          width: "100%",
          height: "100%",
          background: "#000",
          overflow: "hidden",
        }}
      />
    );
  },
);

Globe3D.displayName = "Globe3D";
export default Globe3D;

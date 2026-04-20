import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";
import CameraControls from "camera-controls";

/**
 * Photorealistic 3D Earth Globe
 * ─────────────────────────────────────────────────────────────
 * Custom shader pipeline (inspired by Sangil Lee, threejs-journey,
 * NASA Blue/Black Marble references):
 *
 *   • Day texture (high-res satellite color)
 *   • Night texture (NASA city-lights / black marble)
 *   • Specular map drives ocean reflectivity (sun glint)
 *   • Normal map adds terrain micro-relief
 *   • Day/night blend driven by dot(normal, sunDir) with sigmoid soft terminator
 *   • Atmospheric Rayleigh-style halo via Fresnel back-shell with sun-side mask
 *   • Real-time sun direction computed from current UTC time
 *   • Cloud shell with subtle drift, alpha-mapped
 *   • Star skybox with parallax
 *   • Touch + mouse + wheel via camera-controls
 */

CameraControls.install({ THREE });

export interface Globe3DHandle {
  dollyTo: (distance: number, animate?: boolean) => void;
}

interface Globe3DProps {
  className?: string;
  onDistanceChange?: (distance: number, lat?: number, lng?: number) => void;
  stopRotation?: boolean;
}

// ─── Shaders ──────────────────────────────────────────────
// Earth surface: blends day/night with city lights, adds ocean specular highlight
const earthVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vec4 mvPos = viewMatrix * worldPos;
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const earthFragmentShader = /* glsl */ `
  uniform sampler2D uDayTex;
  uniform sampler2D uNightTex;
  uniform sampler2D uSpecularTex;
  uniform sampler2D uNormalTex;
  uniform vec3 uSunDir;       // view-space direction TO the sun
  uniform vec3 uAtmoColor;
  uniform float uTime;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;

  void main() {
    // Sample maps
    vec3 dayColor   = texture2D(uDayTex, vUv).rgb;
    vec3 nightColor = texture2D(uNightTex, vUv).rgb;
    vec3 specSample = texture2D(uSpecularTex, vUv).rgb;  // ocean mask in any channel
    float oceanMask = specSample.r;                       // bright = water

    // Slight normal-map perturbation for terrain relief (cheap, tangentless)
    vec3 nMap = texture2D(uNormalTex, vUv).rgb * 2.0 - 1.0;
    vec3 N = normalize(vNormal + nMap * 0.25);
    vec3 L = normalize(uSunDir);

    // Day/night soft blend (sigmoid around the terminator for smoothness)
    float ndl = dot(N, L);
    float dayAmount = 1.0 / (1.0 + exp(-12.0 * ndl));     // 0 = night, 1 = day

    // City lights: only on the night side, exclude lit areas
    vec3 cityGlow = nightColor * (1.0 - dayAmount) * 1.6;

    // Lambertian shading on day
    float lambert = clamp(ndl, 0.0, 1.0);
    vec3 lit = dayColor * (0.15 + 0.95 * lambert);

    // Ocean specular highlight (sun glint) — Phong reflection
    vec3 R = reflect(-L, N);
    float spec = pow(max(dot(R, normalize(vViewDir)), 0.0), 32.0);
    vec3 oceanSpec = vec3(1.0, 0.95, 0.85) * spec * oceanMask * 1.4 * dayAmount;

    // Atmospheric rim glow on the day side (cheap fresnel)
    float rim = 1.0 - max(dot(normalize(vViewDir), normalize(vNormal)), 0.0);
    rim = pow(rim, 2.0);
    vec3 rimGlow = uAtmoColor * rim * 0.35 * dayAmount;

    vec3 color = mix(cityGlow, lit, dayAmount) + oceanSpec + rimGlow;

    // Subtle gamma + saturation lift
    color = pow(color, vec3(0.95));
    gl_FragColor = vec4(color, 1.0);
  }
`;

// Atmosphere back-shell: scattering halo around the planet
const atmoVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vec4 mvPos = viewMatrix * worldPos;
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const atmoFragmentShader = /* glsl */ `
  uniform vec3 uAtmoColor;
  uniform vec3 uSunDir;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float intensity = pow(0.72 - dot(vNormal, vViewDir), 3.0);
    float sunFacing = clamp(dot(normalize(vNormal), normalize(uSunDir)) + 0.4, 0.0, 1.0);
    vec3 col = uAtmoColor * intensity * (0.55 + 0.85 * sunFacing);
    gl_FragColor = vec4(col, intensity);
  }
`;

// Compute approximate sun direction in world space from current UTC time.
// Returns a unit vector pointing from Earth center to the sun.
function computeSunDirection(date: Date = new Date()): THREE.Vector3 {
  // Days since J2000.0
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  // Mean longitude of the sun (deg)
  const L = (280.460 + 0.9856474 * n) % 360;
  // Mean anomaly (deg)
  const g = ((357.528 + 0.9856003 * n) % 360) * (Math.PI / 180);
  // Ecliptic longitude (deg)
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * (Math.PI / 180);
  // Obliquity of the ecliptic
  const eps = 23.439 * (Math.PI / 180);
  // Equatorial coordinates
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  // Greenwich Mean Sidereal Time (deg) — rough
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const lst = (gmst * 15) * (Math.PI / 180);
  // Hour angle of the sun (relative to Greenwich)
  const ha = lst - ra;
  // Convert to a direction vector in Earth-fixed frame, then to world
  // We use a Three.js-friendly mapping: x = cos(dec) * sin(-ha), z = cos(dec) * cos(-ha), y = sin(dec)
  const x = Math.cos(dec) * Math.sin(-ha);
  const z = Math.cos(dec) * Math.cos(-ha);
  const y = Math.sin(dec);
  return new THREE.Vector3(x, y, z).normalize();
}

const Globe3D = forwardRef<Globe3DHandle, Globe3DProps>(
  ({ className = "", onDistanceChange, stopRotation = false }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const distanceCbRef = useRef(onDistanceChange);
    const stopRotRef = useRef(stopRotation);
    const controlsRef = useRef<CameraControls | null>(null);

    useEffect(() => { distanceCbRef.current = onDistanceChange; }, [onDistanceChange]);
    useEffect(() => { stopRotRef.current = stopRotation; }, [stopRotation]);

    useImperativeHandle(ref, () => ({
      dollyTo: (distance: number, animate = true) => {
        controlsRef.current?.dollyTo(distance, animate);
      },
    }));

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      // ── Renderer ────────────────────────────────────────────
      const isTouch = "ontouchstart" in window;
      const dpr = Math.min(window.devicePixelRatio, isTouch ? 2 : 2.5);
      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(dpr);
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      container.appendChild(renderer.domElement);

      // ── Camera ─────────────────────────────────────────────
      const camera = new THREE.PerspectiveCamera(
        50,
        container.clientWidth / container.clientHeight,
        1,
        4000,
      );
      camera.position.set(0, 0, 700);

      // ── Controls ───────────────────────────────────────────
      const clock = new THREE.Clock();
      const cameraControls = new CameraControls(camera, renderer.domElement);
      controlsRef.current = cameraControls;

      cameraControls.minDistance = 220;
      cameraControls.maxDistance = 900;
      cameraControls.dampingFactor = 0.06;
      cameraControls.draggingDampingFactor = 0.10;
      cameraControls.dollySpeed = 0.55;
      cameraControls.azimuthRotateSpeed = isTouch ? 0.5 : 0.4;
      cameraControls.polarRotateSpeed = isTouch ? 0.5 : 0.4;
      cameraControls.truckSpeed = 0;
      cameraControls.infinityDolly = false;
      cameraControls.dollyToCursor = true;

      // Tilt slightly toward India for the entry shot
      cameraControls.rotate(0.5, -0.7, false);
      cameraControls.update(0);

      // ── Scene ──────────────────────────────────────────────
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000000);

      const loader = new THREE.TextureLoader();

      // ── Earth (custom shader) ──────────────────────────────
      const RADIUS = 200;
      const earthGeometry = new THREE.SphereGeometry(RADIUS, 128, 128);

      // Placeholder textures while real ones load
      const blackTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
      blackTex.needsUpdate = true;
      const flatNormalTex = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1, THREE.RGBAFormat);
      flatNormalTex.needsUpdate = true;

      const sunDir = computeSunDirection();
      const earthUniforms = {
        uDayTex: { value: blackTex as THREE.Texture },
        uNightTex: { value: blackTex as THREE.Texture },
        uSpecularTex: { value: blackTex as THREE.Texture },
        uNormalTex: { value: flatNormalTex as THREE.Texture },
        uSunDir: { value: sunDir.clone() },
        uAtmoColor: { value: new THREE.Color(0x6ab8ff) },
        uTime: { value: 0 },
      };

      const earthMaterial = new THREE.ShaderMaterial({
        vertexShader: earthVertexShader,
        fragmentShader: earthFragmentShader,
        uniforms: earthUniforms,
      });

      const earth = new THREE.Mesh(earthGeometry, earthMaterial);
      scene.add(earth);

      // Texture loading — high-res
      loader.load("/earth_day_4k.jpg", (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = renderer.capabilities.getMaxAnisotropy();
        earthUniforms.uDayTex.value = t;
      });
      loader.load("/earth_night_4k.jpg", (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = renderer.capabilities.getMaxAnisotropy();
        earthUniforms.uNightTex.value = t;
      });
      loader.load("/earth_specular.jpg", (t) => {
        t.colorSpace = THREE.LinearSRGBColorSpace;
        earthUniforms.uSpecularTex.value = t;
      });
      loader.load("/earth_normal.jpg", (t) => {
        t.colorSpace = THREE.LinearSRGBColorSpace;
        earthUniforms.uNormalTex.value = t;
      });

      // ── Cloud shell ────────────────────────────────────────
      const cloudGeometry = new THREE.SphereGeometry(RADIUS * 1.012, 96, 96);
      const cloudMaterial = new THREE.MeshLambertMaterial({
        opacity: 0.55,
        transparent: true,
        depthWrite: false,
      });
      const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
      earth.add(cloud);
      loader.load("/earth_clouds_hd.png", (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        cloudMaterial.map = t;
        cloudMaterial.alphaMap = t;
        cloudMaterial.needsUpdate = true;
      });

      // ── Atmosphere back-shell ──────────────────────────────
      const atmoGeometry = new THREE.SphereGeometry(RADIUS * 1.05, 96, 96);
      const atmoMaterial = new THREE.ShaderMaterial({
        vertexShader: atmoVertexShader,
        fragmentShader: atmoFragmentShader,
        uniforms: {
          uAtmoColor: { value: new THREE.Color(0x4ea1ff) },
          uSunDir: { value: sunDir.clone() },
        },
        side: THREE.BackSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const atmosphere = new THREE.Mesh(atmoGeometry, atmoMaterial);
      scene.add(atmosphere);

      // ── Stars (large inverted sphere) ──────────────────────
      const starsGeometry = new THREE.SphereGeometry(2000, 48, 48);
      const starsMaterial = new THREE.MeshBasicMaterial({
        side: THREE.BackSide,
        color: 0xffffff,
        depthWrite: false,
      });
      const stars = new THREE.Mesh(starsGeometry, starsMaterial);
      scene.add(stars);
      loader.load("/galaxystarfield.png", (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        starsMaterial.map = t;
        starsMaterial.needsUpdate = true;
      });

      // Procedural sparkle stars (small particles to give depth)
      const sparkleCount = 800;
      const sparklePositions = new Float32Array(sparkleCount * 3);
      for (let i = 0; i < sparkleCount; i++) {
        const r = 1500 + Math.random() * 400;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        sparklePositions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
        sparklePositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        sparklePositions[i * 3 + 2] = r * Math.cos(phi);
      }
      const sparkleGeo = new THREE.BufferGeometry();
      sparkleGeo.setAttribute("position", new THREE.BufferAttribute(sparklePositions, 3));
      const sparkleMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 1.6,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.8,
      });
      const sparkle = new THREE.Points(sparkleGeo, sparkleMat);
      scene.add(sparkle);

      // ── Lighting (still needed for cloud Lambert) ──────────
      const ambient = new THREE.AmbientLight(0xffffff, 0.18);
      scene.add(ambient);
      const sunLight = new THREE.DirectionalLight(0xfff4e0, 1.6);
      scene.add(sunLight);

      // ── User-drag detection ───────────────────────────────
      let userDragging = false;
      const onPointerDown = () => { userDragging = true; };
      const onPointerUp = () => { userDragging = false; };
      container.addEventListener("pointerdown", onPointerDown);
      container.addEventListener("pointerup", onPointerUp);
      container.addEventListener("pointercancel", onPointerUp);

      // ── Resize ────────────────────────────────────────────
      const handleResize = () => {
        if (!container) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", handleResize);

      // ── Cinematic entry: pull back to a beautiful framing ──
      cameraControls.dollyTo(520, true);

      // ── Render loop ───────────────────────────────────────
      let animating = true;
      const sunWorld = new THREE.Vector3();
      const sunView = new THREE.Vector3();

      const animate = () => {
        if (!animating) return;
        requestAnimationFrame(animate);

        const delta = clock.getDelta();
        const elapsed = clock.getElapsedTime();
        cameraControls.update(delta);

        // Rotate earth slowly when idle
        if (!userDragging && !stopRotRef.current) {
          earth.rotation.y += 0.0007;
          stars.rotation.y -= 0.00015;
          sparkle.rotation.y -= 0.00008;
        }
        // Clouds drift slightly faster than the surface (parallax)
        cloud.rotation.y += 0.00012;

        // Sun position: real-time, but slowly animated for visual interest
        // (keeps the terminator visible and moving even when paused)
        const driftedDate = new Date(Date.now() + elapsed * 1000 * 60); // 1s = 1 min
        const sunDirNow = computeSunDirection(driftedDate);
        sunWorld.copy(sunDirNow).multiplyScalar(1500);
        sunLight.position.copy(sunWorld);

        // Convert sun world dir to view-space for the earth shader
        sunView.copy(sunDirNow).transformDirection(camera.matrixWorldInverse);
        earthUniforms.uSunDir.value.copy(sunView);
        earthUniforms.uTime.value = elapsed;
        atmoMaterial.uniforms.uSunDir.value.copy(sunDirNow);

        // Compute lat/lng under the crosshair
        let centerLat: number | undefined;
        let centerLng: number | undefined;
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const intersects = raycaster.intersectObject(earth);
        if (intersects.length > 0) {
          const localP = earth.worldToLocal(intersects[0].point.clone());
          const lat = Math.asin(localP.y / Math.max(RADIUS, Number.EPSILON)) * (180 / Math.PI);
          const lng = Math.atan2(localP.x, localP.z) * (180 / Math.PI);
          centerLat = lat;
          centerLng = lng;
        }

        distanceCbRef.current?.(cameraControls.distance, centerLat, centerLng);
        renderer.render(scene, camera);
      };

      animate();

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
        atmoGeometry.dispose();
        atmoMaterial.dispose();
        starsGeometry.dispose();
        starsMaterial.dispose();
        sparkleGeo.dispose();
        sparkleMat.dispose();
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
          background: "radial-gradient(ellipse at center, #050b1a 0%, #000 60%, #000 100%)",
          overflow: "hidden",
          touchAction: "none",
        }}
      />
    );
  },
);

Globe3D.displayName = "Globe3D";
export default Globe3D;

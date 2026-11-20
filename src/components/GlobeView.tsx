import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

interface GlobeViewProps {
  selectedCoords: { lat: number; lng: number } | null;
  onSelectCoords?: (coords: { lat: number; lng: number }) => void;
  locationLabel?: string;
  width: number;
  height: number;
  zoom: number;
  setZoom: (z: number) => void;
  onWebGLFailed?: () => void;
}

const EARTH_RADIUS = 1;

function coordinateToVector(lat: number, lng: number, radius = EARTH_RADIUS) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

export function GlobeView({ selectedCoords, zoom, setZoom, onWebGLFailed }: GlobeViewProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (zoom > 3 || !rootRef.current) return;

    const root = rootRef.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      onWebGLFailed?.();
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.06, 2.65);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x030303, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    root.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0x8193aa, 0.22);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, 2.25);
    sun.position.set(4.5, 2.4, 5.5);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x334d78, 0.75);
    rim.position.set(-4, 1, -5);
    scene.add(rim);

    const loader = new THREE.TextureLoader();
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS, 96, 96),
      new THREE.MeshPhongMaterial({
        map: loader.load("/earth_day_4k.jpg"),
        normalMap: loader.load("/earth_normal.jpg"),
        normalScale: new THREE.Vector2(0.55, 0.55),
        specularMap: loader.load("/earth_specular.jpg"),
        specular: new THREE.Color(0x334455),
        shininess: 18,
      }),
    );
    scene.add(earth);

    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(1.012, 96, 96),
      new THREE.MeshPhongMaterial({
        map: loader.load("/earth_clouds_hd.png"),
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
      }),
    );
    scene.add(clouds);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.045, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x6f9ed0, transparent: true, opacity: 0.085, side: THREE.BackSide }),
    );
    scene.add(atmosphere);

    const stars = new THREE.Mesh(
      new THREE.SphereGeometry(32, 32, 32),
      new THREE.MeshBasicMaterial({ map: loader.load("/galaxystarfield.png"), side: THREE.BackSide, transparent: true, opacity: 0.7 }),
    );
    scene.add(stars);

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff721c }),
    );
    marker.visible = Boolean(selectedCoords);
    if (selectedCoords) marker.position.copy(coordinateToVector(selectedCoords.lat, selectedCoords.lng, 1.035));
    scene.add(marker);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.045;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = 1.75;
    controls.maxDistance = 4.5;
    controls.rotateSpeed = 0.42;
    controls.zoomSpeed = 0.65;
    controls.addEventListener("change", () => {
      if (camera.position.distanceTo(controls.target) < 1.84) setZoom(19);
    });

    const resize = () => {
      const { clientWidth, clientHeight } = root;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / Math.max(1, clientHeight);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    resize();

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      earth.rotation.y += 0.00042;
      clouds.rotation.y += 0.00053;
      stars.rotation.y -= 0.000035;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      root.removeChild(renderer.domElement);
      [earth, clouds, atmosphere, stars, marker].forEach((object) => {
        object.geometry.dispose();
        const material = object.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material.dispose();
      });
    };
  }, [onWebGLFailed, selectedCoords, setZoom, zoom]);

  if (zoom > 3) return null;

  return (
    <div data-tour="orbital-globe" ref={rootRef} className="absolute inset-0 z-[5] overflow-hidden bg-[#030303]" aria-label="Interactive orbital Earth view" role="img" />
  );
}

export default GlobeView;

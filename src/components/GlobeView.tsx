import React, { useEffect, useRef, useState, useMemo } from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";
import { GlassCard } from "@/components/ui/glass-card";
import { fetchSolarIrradiance } from "@/lib/nasa-power";
import { isWebGLSupported } from "@/lib/webgl-detector";

// Leaflet zoom (1-20) to Globe altitude (0.1 - 10)
export const zoomToAltitude = (zoom: number): number => {
  return Math.exp((20 - zoom) * 0.2) * 0.1;
};

export const altitudeToZoom = (altitude: number): number => {
  return 20 - Math.log(altitude / 0.1) / 0.2;
};

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

export function GlobeView({
  selectedCoords,
  onSelectCoords,
  locationLabel,
  width,
  height,
  zoom,
  setZoom,
  onWebGLFailed,
}: GlobeViewProps) {
  const reactGlobeRef = useRef<any>(null);
  const [hoveredMarker, setHoveredMarker] = useState<{ lat: number; lng: number } | null>(null);
  
  // Staggered loading state step
  const [loadStep, setLoadStep] = useState(0); // 0: wireframe, 1: atmosphere, 2: terrain, 3: clouds, 4: markers/UI
  const loadStepRef = useRef(loadStep);

  // 3-second user scroll guide hint
  const [showHint, setShowHint] = useState(true);
  
  const [stats, setStats] = useState<{
    psh: number;
    source: string;
    suitability: string;
    yield: number;
  } | null>(null);

  // WebGL & Preloading safety states
  const [webglFailed, setWebglFailed] = useState(false);
  const [texturesLoaded, setTexturesLoaded] = useState(false);
  const [textures, setTextures] = useState<{
    normalMap: THREE.Texture | null;
    specularMap: THREE.Texture | null;
    cloudMap: THREE.Texture | null;
  }>({ normalMap: null, specularMap: null, cloudMap: null });

  const [nightImageUrl, setNightImageUrl] = useState("/earth_night_4k.jpg");

  const opacity = useMemo(() => {
    if (zoom <= 3) return 1;
    if (zoom >= 4) return 0;
    return 1 - (zoom - 3);
  }, [zoom]);

  useEffect(() => {
    if (webglFailed) {
      onWebGLFailed?.();
    }
  }, [webglFailed, onWebGLFailed]);

  // ── 1. Starfield stars data ────────────────────────────────
  const stars = useMemo(() => {
    return Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      size: `${Math.random() * 1.5 + 0.5}px`,
      delay: `${Math.random() * 4}s`,
    }));
  }, []);

  // Update loadStep reference
  useEffect(() => {
    loadStepRef.current = loadStep;
  }, [loadStep]);

  // Hide hint after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // ── 2. Check WebGL support on mount ────────────────────────
  useEffect(() => {
    if (!isWebGLSupported()) {
      console.warn("WebGL not supported on this device/browser");
      setWebglFailed(true);
    }
  }, []);

  // ── 3. Texture preloading with error boundaries & CDN fallbacks ────────────
  useEffect(() => {
    if (webglFailed) return;

    const loadTextures = async () => {
      try {
        const textureLoader = new THREE.TextureLoader();

        const loadTexture = (url: string): Promise<THREE.Texture> => {
          return new Promise((resolve, reject) => {
            textureLoader.load(
              url,
              (texture) => resolve(texture),
              undefined,
              (error) => reject(error)
            );
            // Timeout after 5 seconds to prevent indefinite loading hang
            setTimeout(() => reject(new Error(`Texture load timeout: ${url}`)), 5000);
          });
        };

        const loadTextureWithFallback = async (localUrl: string, fallbackUrl: string): Promise<THREE.Texture> => {
          try {
            return await loadTexture(localUrl);
          } catch (e) {
            console.warn(`Local texture ${localUrl} failed to load, trying CDN fallback: ${fallbackUrl}`, e);
            return await loadTexture(fallbackUrl);
          }
        };

        let nightUrl = "/earth_night_4k.jpg";
        try {
          await loadTexture("/earth_night_4k.jpg");
        } catch (e) {
          console.warn("Local night map failed, falling back to CDN", e);
          nightUrl = "https://unpkg.com/three-globe/example/img/earth-night.jpg";
        }
        setNightImageUrl(nightUrl);

        const [normalMap, specularMap, cloudMap] = await Promise.all([
          loadTextureWithFallback("/earth_normal.jpg", "https://unpkg.com/three-globe/example/img/earth-topology.png"),
          loadTextureWithFallback("/earth_specular.jpg", "https://unpkg.com/three-globe/example/img/earth-water.png"),
          loadTextureWithFallback("/earth_clouds_hd.png", "https://unpkg.com/three-globe/example/img/earth-clouds.png"),
        ]);

        setTextures({ normalMap, specularMap, cloudMap });
        setTexturesLoaded(true);
      } catch (error) {
        console.error("Failed to load globe textures, falling back to 2D:", error);
        setWebglFailed(true);
      }
    };

    loadTextures();
  }, [webglFailed]);

  // ── 4. Staggered Progressive Loading Sequence ──────────────
  useEffect(() => {
    if (!texturesLoaded || webglFailed) return;
    const t1 = setTimeout(() => setLoadStep(1), 300);  // Fade in atmosphere
    const t2 = setTimeout(() => setLoadStep(2), 650);  // Fade in terrain, fade out wireframe
    const t3 = setTimeout(() => setLoadStep(3), 1050); // Fade in clouds
    const t4 = setTimeout(() => setLoadStep(4), 1450); // Fade in UI overlays & markers
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [texturesLoaded, webglFailed]);

  // ── 5. Fetch Irradiance stats when location selected ───────
  useEffect(() => {
    if (selectedCoords) {
      fetchSolarIrradiance(selectedCoords.lat, selectedCoords.lng)
        .then((res) => {
          const yieldVal = Math.round(res.peakSunHours * 365 * 0.86);
          let suitability = "Medium Potential";
          if (res.peakSunHours > 5.0) suitability = "Excellent Potential";
          else if (res.peakSunHours > 4.5) suitability = "High Potential";
          else if (res.peakSunHours < 3.8) suitability = "Low Potential";

          setStats({
            psh: res.peakSunHours,
            source:
              res.source === "GOOGLE_SOLAR"
                ? "Google Solar API"
                : res.source === "NSRDB_IODC"
                  ? "NREL NSRDB (India)"
                  : res.source === "NASA_POWER"
                    ? "NASA POWER API"
                    : "Regional Fallback",
            suitability,
            yield: yieldVal,
          });
        })
        .catch((e) => {
          console.error("Failed to fetch irradiance for bottom cards:", e);
        });
    } else {
      setStats(null);
    }
  }, [selectedCoords]);

  // ── 6. Synchronize incoming zoom from props to camera altitude ──
  useEffect(() => {
    const globe = reactGlobeRef.current;
    if (!globe || !texturesLoaded) return;
    const currentAlt = globe.pointOfView().altitude;
    const targetAlt = zoomToAltitude(zoom);
    if (Math.abs(currentAlt - targetAlt) > 0.02) {
      globe.pointOfView({ altitude: targetAlt }, 600);
    }
  }, [zoom, texturesLoaded]);

  // ── 7. WebGL custom materials, clouds, and wireframe ────────
  useEffect(() => {
    if (!texturesLoaded || webglFailed) return;

    const globe = reactGlobeRef.current;
    if (!globe) return;

    // Enable damping (inertia physics) on OrbitControls
    const controls = globe.controls();
    if (controls) {
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.enableZoom = true;
      controls.minDistance = 140;
      controls.maxDistance = 500;
    }

    // Find the ThreeGlobe instance by traversing the ThreeJS Scene
    let globeObj: THREE.Object3D | null = null;
    const scene = globe.scene();
    if (scene) {
      scene.traverse((obj: any) => {
        if (
          obj.constructor.name === "ThreeGlobe" ||
          obj.isGlobe ||
          (obj.type === "Group" && obj.children.length > 0)
        ) {
          let hasSphere = false;
          obj.traverse((child: any) => {
            if (child.isMesh && child.geometry && child.geometry.type === "SphereGeometry") {
              hasSphere = true;
            }
          });
          if (hasSphere) {
            globeObj = obj;
          }
        }
      });
      if (!globeObj) {
        globeObj = scene.children.find((child: any) => child.type === "Group") || null;
      }
    }

    if (!globeObj) {
      console.warn("ThreeGlobe instance not found in scene.");
      return;
    }

    // Find the main globe sphere material
    let material: THREE.MeshStandardMaterial | null = null;
    globeObj.traverse((child: any) => {
      if (
        child.isMesh &&
        child.geometry &&
        child.geometry.type === "SphereGeometry" &&
        child.name !== "wireframe" &&
        child.name !== "clouds"
      ) {
        material = child.material as THREE.MeshStandardMaterial;
      }
    });

    if (!material) {
      console.warn("Globe material not found.");
      return;
    }

    // Set terrain bump normal map & ocean shine
    material.roughness = 0.55;
    material.metalness = 0.15;
    material.transparent = true;
    material.opacity = 0; // Starts hidden, faded in by progressive sequence

    if (textures.normalMap) {
      material.bumpMap = textures.normalMap;
      material.bumpScale = 1.6;
      material.needsUpdate = true;
    }

    if (textures.specularMap) {
      material.roughnessMap = textures.specularMap;
      material.metalnessMap = textures.specularMap;
      material.needsUpdate = true;
    }

    // Create wireframe earth overlay
    const wireGeom = new THREE.SphereGeometry(100 * 0.998, 48, 48);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.6,
    });
    const wireMesh = new THREE.Mesh(wireGeom, wireMat);
    wireMesh.name = "wireframe";
    globeObj.add(wireMesh);

    // Create cloud shell (semi-transparent, slightly larger)
    let cloudMesh: THREE.Mesh | null = null;
    let cloudMat: THREE.MeshStandardMaterial | null = null;

    if (textures.cloudMap) {
      const cloudGeom = new THREE.SphereGeometry(100 * 1.015, 64, 64);
      cloudMat = new THREE.MeshStandardMaterial({
        map: textures.cloudMap,
        alphaMap: textures.cloudMap,
        transparent: true,
        opacity: 0, // Fades in progressively
        depthWrite: false,
        blending: THREE.NormalBlending,
      });
      cloudMesh = new THREE.Mesh(cloudGeom, cloudMat);
      cloudMesh.name = "clouds";
      globeObj.add(cloudMesh);
    }

    // Camera fly-to focus
    if (selectedCoords) {
      globe.pointOfView(
        {
          lat: selectedCoords.lat,
          lng: selectedCoords.lng,
          altitude: zoomToAltitude(zoom),
        },
        1800
      );
    }

    // Listen to OrbitControls zoom/pan interactions to sync zoom/coords
    const handleControlsChange = () => {
      const pov = globe.pointOfView();
      if (!pov) return;
      const newZoom = altitudeToZoom(pov.altitude);

      // Dynamically align center coordinates
      if (pov.lat && pov.lng) {
        onSelectCoords?.({ lat: pov.lat, lng: pov.lng });
      }

      setZoom(newZoom);
    };

    if (controls) {
      controls.addEventListener("change", handleControlsChange);
    }

    // Animation & Fading tick loop
    let animId: number;
    let targetWireOpacity = 0.6;
    let targetTerrainOpacity = 0.0;
    let targetCloudOpacity = 0.0;

    const tick = () => {
      // Rotate clouds slowly (0.2 rpm)
      const clouds = globeObj.getObjectByName("clouds");
      if (clouds) {
        clouds.rotation.y += 0.0003;
      }

      // Smooth opacity transitions based on step ref (prevents effect restarts)
      const step = loadStepRef.current;
      if (step === 0) {
        targetWireOpacity = 0.6;
        targetTerrainOpacity = 0.0;
        targetCloudOpacity = 0.0;
      } else if (step === 1) {
        targetWireOpacity = 0.6;
        targetTerrainOpacity = 0.05;
        targetCloudOpacity = 0.0;
      } else if (step === 2) {
        targetWireOpacity = 0.0;
        targetTerrainOpacity = 1.0;
        targetCloudOpacity = 0.0;
      } else if (step >= 3) {
        targetWireOpacity = 0.0;
        targetTerrainOpacity = 1.0;
        targetCloudOpacity = 0.35;
      }

      // Lerp opacities
      wireMat.opacity += (targetWireOpacity - wireMat.opacity) * 0.08;
      material.opacity += (targetTerrainOpacity - material.opacity) * 0.08;
      if (cloudMat) {
        cloudMat.opacity += (targetCloudOpacity - cloudMat.opacity) * 0.08;
      }

      // Keep OrbitControls updated for inertia physics
      if (controls) controls.update();

      animId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(animId);
      if (controls) {
        controls.removeEventListener("change", handleControlsChange);
      }
      wireGeom.dispose();
      wireMat.dispose();
      globeObj.remove(wireMesh);

      if (cloudMesh) {
        cloudMesh.geometry.dispose();
        if (Array.isArray(cloudMesh.material)) {
          cloudMesh.material.forEach((m) => m.dispose());
        } else {
          cloudMesh.material.dispose();
        }
        globeObj.remove(cloudMesh);
      }
    };
  }, [texturesLoaded, webglFailed]);

  // Handle marker click (zoom smoothly to selection)
  const handleMarkerClick = (lat: number, lng: number) => {
    reactGlobeRef.current?.pointOfView({ lat, lng, altitude: 0.8 }, 1500);
  };

  // ── 8. Render Fallback UI if WebGL/preloader fails ─────────
  if (webglFailed) {
    return null;
  }

  // ── 9. Render Loader UI until textures are fully cached ───
  if (!texturesLoaded) {
    return (
      <div className="absolute inset-0 z-[5] bg-[#0E0E0F] flex flex-col items-center justify-center select-none">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/50 mb-3" />
        <span className="text-xs text-white/40 font-mono uppercase tracking-widest">Caching planetary shaders...</span>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 z-[5] bg-black overflow-hidden select-none transition-opacity duration-150"
      style={{
        opacity: opacity,
        pointerEvents: opacity > 0 ? "auto" : "none",
      }}
    >
      {/* ── starfield backdrop ── */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {stars.map((star) => (
          <div
            key={star.id}
            className="star animate-twinkle bg-white rounded-full absolute"
            style={{
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
              animationDelay: star.delay,
              boxShadow: "0 0 2px rgba(255, 255, 255, 0.4)",
            }}
          />
        ))}
      </div>

      {/* ── vignette corners overlay ── */}
      <div
        className="absolute inset-0 pointer-events-none z-[8]"
        style={{
          background: "radial-gradient(circle, transparent 45%, rgba(0,0,0,0.85) 100%)",
        }}
      />

      {/* ── Globe rendering canvas ── */}
      <Globe
        ref={reactGlobeRef}
        width={width}
        height={height}
        backgroundColor="rgba(0,0,0,0)"
        showAtmosphere={loadStep >= 1}
        atmosphereColor="#d9f2ff"
        atmosphereAltitude={0.15}
        globeImageUrl={nightImageUrl}
        htmlElementsData={
          loadStep >= 4 && selectedCoords
            ? [{ lat: selectedCoords.lat, lng: selectedCoords.lng }]
            : []
        }
        htmlElement={(dData: object) => {
          const d = dData as { lat: number; lng: number };
          const el = document.createElement("div");
          el.className = "relative flex items-center justify-center cursor-pointer";
          el.style.width = "32px";
          el.style.height = "32px";

          el.innerHTML = `
            <div class="pulse-ring pulse-ring-1"></div>
            <div class="pulse-ring pulse-ring-2"></div>
            <div class="pulse-ring pulse-ring-3"></div>
            <div class="w-3.5 h-3.5 rounded-full bg-[#FF6600] border-2 border-white shadow-[0_0_12px_rgba(255,102,0,0.9)] z-10 transition-transform duration-300"></div>
          `;

          // Hover interactions
          el.addEventListener("mouseenter", () => {
            const innerDot = el.querySelector(".bg-\\[\\#FF6600\\]");
            if (innerDot) (innerDot as HTMLElement).style.transform = "scale(1.25)";
            setHoveredMarker({ lat: d.lat, lng: d.lng });
          });

          el.addEventListener("mouseleave", () => {
            const innerDot = el.querySelector(".bg-\\[\\#FF6600\\]");
            if (innerDot) (innerDot as HTMLElement).style.transform = "scale(1)";
            setHoveredMarker(null);
          });

          // Click interactions
          el.addEventListener("click", () => handleMarkerClick(d.lat, d.lng));

          return el;
        }}
        onGlobeClick={(clickCoords) => {
          onSelectCoords?.(clickCoords);
        }}
      />

      {/* ── hover glass tooltip ── */}
      {hoveredMarker && (
        <div
          className="absolute top-[25%] left-1/2 -translate-x-1/2 bg-white/5 border border-white/10 backdrop-blur-md px-4 py-2 rounded-lg text-xs text-white/90 z-20 pointer-events-none shadow-lg animate-in fade-in duration-200"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          <span className="font-semibold text-[#FF6600]">Rooftop Candidate</span>
          <div className="text-[10px] text-white/60 font-mono mt-0.5">
            {hoveredMarker.lat.toFixed(5)}°N, {hoveredMarker.lng.toFixed(5)}°E
          </div>
        </div>
      )}

      {/* ── scroll guide hint overlay ── */}
      {showHint && (
        <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2 bg-black/50 border border-white/10 backdrop-blur-md px-5 py-2.5 rounded-full text-xs text-white/70 z-20 pointer-events-none shadow-lg animate-out fade-out duration-1000 delay-2000 font-mono tracking-wide uppercase">
          Scroll to zoom · Drag to pan
        </div>
      )}

      {/* ── bottom glass cards statistics overlays ── */}
      {loadStep >= 4 && selectedCoords && stats && (
        <div className="absolute bottom-10 left-4 right-4 md:left-8 md:right-8 grid grid-cols-1 md:grid-cols-3 gap-4 z-[9] animate-in slide-in-from-bottom duration-500 ease-out fade-in">
          {/* Card 1: Location */}
          <GlassCard className="p-4 flex flex-col justify-between border-white/10 bg-white/5 backdrop-blur-md">
            <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest font-mono">Location Profile</span>
            <div className="mt-2 text-sm font-semibold text-white/90 truncate">{locationLabel || "Selected Rooftop"}</div>
            <div className="text-[10px] text-white/50 font-mono mt-1">GPS: {selectedCoords.lat.toFixed(5)}, {selectedCoords.lng.toFixed(5)}</div>
          </GlassCard>

          {/* Card 2: Solar Irradiance */}
          <GlassCard className="p-4 flex flex-col justify-between border-white/10 bg-white/5 backdrop-blur-md">
            <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest font-mono">Solar Irradiance</span>
            <div className="mt-2 text-sm font-semibold text-white/90 flex items-baseline gap-1">
              <span className="text-lg text-[#FF6600] font-bold font-mono">{stats.psh.toFixed(2)}</span>
              <span className="text-[10px] text-white/60">kWh/m²/day (PSH)</span>
            </div>
            <div className="text-[10px] text-white/50 font-mono mt-1">Source: {stats.source}</div>
          </GlassCard>

          {/* Card 3: Potential */}
          <GlassCard className="p-4 flex flex-col justify-between border-white/10 bg-white/5 backdrop-blur-md" glow>
            <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest font-mono">Rooftop Potential</span>
            <div className="mt-2 text-sm font-semibold text-white/90 flex items-center justify-between">
              <span className="text-[#2BD4A0] font-bold">{stats.suitability}</span>
              <span className="text-xs text-white/70 font-mono">~{stats.yield} kWh/kWp/yr</span>
            </div>
            <div className="text-[10px] text-white/50 font-mono mt-1">Optimal Generation Rating</div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
export default GlobeView;

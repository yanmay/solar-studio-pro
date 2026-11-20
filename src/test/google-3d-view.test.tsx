import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Google3DView from "@/components/Google3DView";
import RooftopARViewer, { localizeRoofPolygons } from "@/components/RooftopARViewer";

describe("Google3DView rotation controls", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("uses the photorealistic 3D camera and applies tilt and heading controls", async () => {
    let camera: (HTMLElement & { heading?: number; tilt?: number }) | null = null;
    class FakeMap3DElement {
      constructor(options: Record<string, unknown>) {
        const element = document.createElement("div") as HTMLElement & {
          heading?: number;
          tilt?: number;
        };
        Object.assign(element, options);
        camera = element;
        return element;
      }
    }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tilt: 62, maxZoom: 20, confidence: 0.9 }),
    }));
    vi.stubGlobal("google", {
      maps: {
        importLibrary: vi.fn().mockResolvedValue({ Map3DElement: FakeMap3DElement }),
      },
    });

    render(<Google3DView center={{ lat: 19.076, lng: 72.877 }} zoom={19} />);
    const root = screen.getByLabelText("Interactive 3D satellite map");
    await waitFor(() => expect(root).toHaveAttribute("data-map-renderer", "photorealistic-3d"));
    await waitFor(() => expect(camera?.tilt).toBe(62));

    fireEvent.click(screen.getByRole("button", { name: "Rotate 45 degrees clockwise" }));

    await waitFor(() => expect(camera?.heading).toBe(45));
    expect(screen.getByRole("status", { name: "Map heading" })).toHaveAttribute("data-heading", "45");
  });

  it("keeps the photorealistic 3D camera rotating while idle", async () => {
    vi.useFakeTimers();
    let camera: (HTMLElement & { heading?: number }) | null = null;
    class FakeMap3DElement {
      constructor() {
        camera = document.createElement("div") as HTMLElement & { heading?: number };
        return camera;
      }
    }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    vi.stubGlobal("google", {
      maps: { importLibrary: vi.fn().mockResolvedValue({ Map3DElement: FakeMap3DElement }) },
    });

    render(<Google3DView center={null} zoom={19} />);
    await act(async () => Promise.resolve());
    await act(async () => vi.advanceTimersByTimeAsync(240));

    expect(camera?.heading).toBe(3);
  });

  it("shows a rotatable CSS 3D scene when Google 3D and WebGL are unavailable", async () => {
    vi.stubGlobal("WebGLRenderingContext", undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    vi.stubGlobal("google", {
      maps: { importLibrary: vi.fn().mockRejectedValue(new Error("maps3d unavailable")) },
    });

    render(<Google3DView center={{ lat: 19.076, lng: 72.877 }} zoom={19} />);
    const root = screen.getByLabelText("Interactive 3D satellite map");
    await waitFor(() => expect(root).toHaveAttribute("data-map-renderer", "css-fallback"));
    const scene = screen.getByTestId("css-3d-scene");
    expect(scene.style.transform).toContain("rotateZ(0deg)");

    fireEvent.click(screen.getByRole("button", { name: "Rotate 45 degrees clockwise" }));

    expect(scene.style.transform).toContain("rotateZ(45deg)");
    expect(screen.getByRole("status", { name: "Map heading" })).toHaveAttribute("data-heading", "45");
  });

  it("keeps the local 3D fallback rotating while idle", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebGLRenderingContext", undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    vi.stubGlobal("google", {
      maps: { importLibrary: vi.fn().mockRejectedValue(new Error("maps3d unavailable")) },
    });

    render(<Google3DView center={null} zoom={19} />);
    await act(async () => Promise.resolve());
    expect(screen.getByRole("status", { name: "Map heading" })).toHaveAttribute("data-heading", "0");

    await act(async () => vi.advanceTimersByTimeAsync(240));

    expect(screen.getByRole("status", { name: "Map heading" })).toHaveAttribute("data-heading", "3");
  });

  it("activates the local 3D scene when Google Maps loading stalls", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebGLRenderingContext", undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    vi.stubGlobal("google", {
      maps: { importLibrary: vi.fn(() => new Promise(() => undefined)) },
    });

    render(<Google3DView center={null} zoom={19} />);
    const root = screen.getByLabelText("Interactive 3D satellite map");
    expect(root).toHaveAttribute("data-map-renderer", "unavailable");

    await act(async () => vi.advanceTimersByTimeAsync(3000));

    expect(root).toHaveAttribute("data-map-renderer", "css-fallback");
    expect(screen.getByTestId("css-3d-scene")).toBeInTheDocument();
  });

  it("finishes calibration when profile changes do not emit tilesloaded", async () => {
    vi.useFakeTimers();
    let frameTime = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frameTime += 16.7;
      callback(frameTime);
      return frameTime;
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tilt: 45, maxZoom: 18, confidence: 0.9 }),
    }));
    vi.stubGlobal("google", {
      maps: {
        importLibrary: vi.fn().mockResolvedValue({
          Map3DElement: class {
            constructor() {
              const element = document.createElement("div");
              return element;
            }
          },
        }),
        event: { addListener: vi.fn() },
      },
    });

    render(<Google3DView center={null} zoom={19} />);
    await act(async () => Promise.resolve());
    const calibrate = screen.getByRole("button", { name: "Calibrate 3D rendering profiles" });
    expect(calibrate).toBeEnabled();

    fireEvent.click(calibrate);
    expect(calibrate).toHaveAttribute("title", "3D calibration in progress");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3200);
    });

    expect(calibrate).toBeEnabled();
    expect(calibrate).toHaveAttribute("title", "Measure alternative 3D rendering profiles");
    expect(screen.getByRole("button", { name: "Download 3D training telemetry" })).toHaveTextContent("2");
  });

  it("wraps heading through a complete 360-degree turn and resets", () => {
    render(<Google3DView center={null} zoom={19} />);

    const clockwise = screen.getByRole("button", { name: "Rotate 45 degrees clockwise" });
    const counterclockwise = screen.getByRole("button", { name: "Rotate 45 degrees counterclockwise" });
    const reset = screen.getByRole("button", { name: "Reset map rotation" });
    expect(screen.getByRole("button", { name: "Download 3D training telemetry" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "3D telemetry promotion readiness" })).toHaveTextContent("0/32");
    const heading = screen.getByRole("status", { name: "Map heading" });

    for (let index = 0; index < 8; index += 1) fireEvent.click(clockwise);
    expect(heading).toHaveAttribute("data-heading", "0");

    fireEvent.click(counterclockwise);
    expect(heading).toHaveAttribute("data-heading", "315");

    fireEvent.click(reset);
    expect(heading).toHaveAttribute("data-heading", "0");
  });

  it("does not apply a low-confidence rendering profile", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tilt: 35, maxZoom: 15, confidence: 0.1 }),
    }));
    render(<Google3DView center={null} zoom={19} />);
    const root = screen.getByLabelText("Interactive 3D satellite map");
    await waitFor(() => expect(root).toHaveAttribute("data-profile-confidence", "0.1"));
    expect(root).toHaveAttribute("data-profile-applied", "false");
    expect(root).toHaveAttribute("data-profile-tilt", "45");
    expect(root).toHaveAttribute("data-profile-max-zoom", "18");
  });

  it("applies a high-confidence rendering profile", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tilt: 62, maxZoom: 20, confidence: 0.9 }),
    }));
    render(<Google3DView center={null} zoom={19} />);
    const root = screen.getByLabelText("Interactive 3D satellite map");
    await waitFor(() => expect(root).toHaveAttribute("data-profile-applied", "true"));
    expect(root).toHaveAttribute("data-profile-tilt", "62");
    expect(root).toHaveAttribute("data-profile-max-zoom", "20");
  });
});

describe("RooftopARViewer model parameters", () => {
  it("normalizes surveyed geographic polygons into a bounded local footprint", () => {
    const footprint = localizeRoofPolygons([[
      { lat: 19.076, lng: 72.877 },
      { lat: 19.076, lng: 72.878 },
      { lat: 19.077, lng: 72.878 },
      { lat: 19.077, lng: 72.877 },
    ]]);

    expect(footprint).not.toBeNull();
    expect(footprint?.width).toBeGreaterThan(0);
    expect(footprint?.depth).toBeGreaterThan(0);
    expect(footprint?.polygons[0]).toHaveLength(4);
    expect(footprint?.polygons.flat().every(([x, y]) => Math.abs(x) <= 4 && Math.abs(y) <= 4)).toBe(true);
  });

  it("ignores incomplete roof rings when calculating local proportions", () => {
    const validRoof = [
      { lat: 19.076, lng: 72.877 },
      { lat: 19.076, lng: 72.8772 },
      { lat: 19.0761, lng: 72.8772 },
      { lat: 19.0761, lng: 72.877 },
    ];
    const baseline = localizeRoofPolygons([validRoof]);
    const withInvalidRing = localizeRoofPolygons([
      validRoof,
      [{ lat: 80, lng: -120 }, { lat: 80.0001, lng: -120 }],
    ]);

    expect(withInvalidRing?.polygons).toHaveLength(1);
    expect(withInvalidRing?.width / withInvalidRing?.depth).toBeCloseTo(
      (baseline?.width ?? 0) / (baseline?.depth ?? 1),
      5,
    );
  });

  it("exposes the selected roof geometry parameters", () => {
    render(
      <RooftopARViewer
        installedKw={6.6}
        panelCount={12}
        areaM2={32}
        tiltDeg={27}
        azimuthDeg={225}
      orientation="landscape"
        roofPolygons={[[
          { lat: 19.076, lng: 72.877 },
          { lat: 19.076, lng: 72.878 },
          { lat: 19.077, lng: 72.878 },
          { lat: 19.077, lng: 72.877 },
        ]]}
        panelFootprints={[[
          { lat: 19.0762, lng: 72.8772 },
          { lat: 19.0762, lng: 72.8774 },
          { lat: 19.0764, lng: 72.8774 },
          { lat: 19.0764, lng: 72.8772 },
        ]]}
      />,
    );

    const preview = screen.getByRole("region", { name: "AR rooftop preview" });
    expect(preview).toHaveAttribute("data-tilt-deg", "27");
    expect(preview).toHaveAttribute("data-azimuth-deg", "225");
    expect(preview).toHaveAttribute("data-panel-orientation", "landscape");
    expect(preview).toHaveAttribute("data-roof-polygon-count", "1");
    expect(preview).toHaveAttribute("data-panel-footprint-count", "1");
  });

  it("supports a complete 360-degree orbit with reset controls", () => {
    render(<RooftopARViewer installedKw={6.6} panelCount={12} areaM2={32} />);
    fireEvent.click(screen.getByRole("button", { name: "Open 3D Preview" }));

    const heading = screen.getByRole("status", { name: "Rooftop heading" });
    const clockwise = screen.getByRole("button", { name: "Rotate rooftop 45 degrees clockwise" });
    const counterclockwise = screen.getByRole("button", { name: "Rotate rooftop 45 degrees counterclockwise" });
    const reset = screen.getByRole("button", { name: "Reset rooftop rotation" });

    for (let index = 0; index < 8; index += 1) fireEvent.click(clockwise);
    expect(heading).toHaveAttribute("data-heading", "0");

    fireEvent.click(counterclockwise);
    expect(heading).toHaveAttribute("data-heading", "315");

    fireEvent.click(reset);
    expect(heading).toHaveAttribute("data-heading", "0");
  });
});

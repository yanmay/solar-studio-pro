import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimatedSphere } from "@/components/landing/animated-sphere";
import { AnimatedTetrahedron } from "@/components/landing/animated-tetrahedron";

describe("landing page 3D models", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders both animated canvas models", () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      clearRect: vi.fn(),
      scale: vi.fn(),
      fillText: vi.fn(),
      set font(_value: string) {},
      set textAlign(_value: CanvasTextAlign) {},
      set textBaseline(_value: CanvasTextBaseline) {},
      set fillStyle(_value: string | CanvasGradient | CanvasPattern) {},
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 300,
      height: 300,
      top: 0,
      right: 300,
      bottom: 300,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    render(
      <div aria-label="Animated 3D solar models">
        <AnimatedSphere />
        <AnimatedTetrahedron />
      </div>,
    );

    expect(screen.getByLabelText("Animated 3D solar models").querySelectorAll("canvas")).toHaveLength(2);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
  });
});

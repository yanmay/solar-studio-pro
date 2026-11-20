import { describe, it, expect, beforeAll } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import TimeOfUseCard from "@/components/TimeOfUseCard";
import { buildTimeOfUse } from "@/lib/time-of-use";

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("TimeOfUseCard & Power Curve", () => {
  it("buildTimeOfUse generates 96 intervals with non-zero generation and load", () => {
    const tou = buildTimeOfUse(25, 25, 19.0596);
    expect(tou.curve.length).toBe(96);

    const maxGen = Math.max(...tou.curve.map((c) => c.genKwh));
    const maxLoad = Math.max(...tou.curve.map((c) => c.loadKwh));

    expect(maxGen).toBeGreaterThan(0);
    expect(maxLoad).toBeGreaterThan(0);
    expect(tou.selfConsumptionPct).toBeGreaterThan(0);
  });

  it("renders TimeOfUseCard component without throwing", () => {
    const { container } = render(
      <TimeOfUseCard dailyGenKwh={23.3} dailyLoadKwh={20} lat={19.0596} />
    );

    expect(container.textContent).toContain("When To Use Your Power");
    expect(container.textContent).toContain("Solar Generation");
    expect(container.textContent).toContain("House Load");
    expect(container.textContent).toContain("Self-Use Ratio");
  });
});

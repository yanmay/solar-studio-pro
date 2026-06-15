import { describe, it, expect, beforeEach } from "vitest";
import { useScanStore } from "../hooks/use-scan-store";
import type { ScanInput } from "../types/scan";

describe("useScanStore", () => {
  beforeEach(() => {
    useScanStore.getState().reset();
  });

  it("should set scanInput correctly when setScanInput is called", () => {
    const input: ScanInput = {
      address: "123 Solar St",
      lat: 12.34,
      lng: 56.78,
      roofPolygon: [{
        type: "Polygon",
        coordinates: [
          [
            [12.34, 56.78],
            [12.35, 56.78],
            [12.35, 56.79],
            [12.34, 56.78],
          ],
        ],
      }],
      roofAreaM2: 150,
    };

    useScanStore.getState().setScanInput(input);
    expect(useScanStore.getState().scanInput).toEqual(input);
  });

  it("should set isPaid and paymentId correctly when setIsPaid is called", () => {
    // Test sets both values when paymentId is provided
    useScanStore.getState().setIsPaid(true, "pay_12345");
    expect(useScanStore.getState().isPaid).toBe(true);
    expect(useScanStore.getState().paymentId).toBe("pay_12345");

    // Test default parameter when no paymentId is provided
    useScanStore.getState().setIsPaid(false);
    expect(useScanStore.getState().isPaid).toBe(false);
    expect(useScanStore.getState().paymentId).toBeNull();
  });

  it("should reset all states to initial values when reset is called", () => {
    const input: ScanInput = {
      address: "123 Solar St",
      lat: 12.34,
      lng: 56.78,
      roofPolygon: [{
        type: "Polygon",
        coordinates: [
          [
            [12.34, 56.78],
            [12.35, 56.78],
            [12.35, 56.79],
            [12.34, 56.78],
          ],
        ],
      }],
      roofAreaM2: 150,
    };

    const store = useScanStore.getState();
    store.setScanInput(input);
    store.setIsPaid(true, "pay_abc");
    store.setTariff({ tariffPerKwh: 8.5 });

    expect(useScanStore.getState().scanInput).toEqual(input);
    expect(useScanStore.getState().isPaid).toBe(true);
    expect(useScanStore.getState().paymentId).toBe("pay_abc");
    expect(useScanStore.getState().tariff).toEqual({ tariffPerKwh: 8.5 });

    store.reset();

    expect(useScanStore.getState().scanInput).toBeNull();
    expect(useScanStore.getState().panelConfig).toBeNull();
    expect(useScanStore.getState().tariff).toBeNull();
    expect(useScanStore.getState().results).toBeNull();
    expect(useScanStore.getState().isPaid).toBe(false);
    expect(useScanStore.getState().paymentId).toBeNull();
  });
});

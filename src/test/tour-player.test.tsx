import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TourPlayer } from "@/components/ui/tour-player";

describe("TourPlayer", () => {
  it("shows progress and supports pause, resume, and skip", () => {
    vi.useFakeTimers();
    const onAdvance = vi.fn();
    const onSkip = vi.fn();

    render(
      <TourPlayer
        active
        title="Find your rooftop"
        step={1}
        totalSteps={3}
        durationMs={8000}
        onAdvance={onAdvance}
        onSkip={onSkip}
      />,
    );

    expect(screen.getByText("Guided rooftop tour")).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pause guided tour" }));
    act(() => vi.advanceTimersByTime(9000));
    expect(onAdvance).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Resume guided tour" }));
    act(() => vi.advanceTimersByTime(8000));
    expect(onAdvance).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Skip guided tour" }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

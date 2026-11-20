import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import LeadDetail from "@/pages/installer/LeadDetail";

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe("installer lead detail", () => {
  it("renders the fallback lead dossier without entering the error boundary", async () => {
    render(
      <MemoryRouter initialEntries={["/installer/lead/demo"]}>
        <Routes>
          <Route path="/installer/lead/:leadId" element={<LeadDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Ramesh Sharma" })).toBeInTheDocument();
    expect(screen.getByText("Horizon Shading Loss")).toBeInTheDocument();
  });
});

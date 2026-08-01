import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PlayerFilterControls from "../PlayerFilterControls";

describe("PlayerFilterControls", () => {
  it("renders team and position options", () => {
    render(
      <PlayerFilterControls
        onFilterChange={vi.fn()}
        availableTeams={["HOU", "LAD"]}
        availablePositions={["2B", "SS"]}
      />
    );
    expect(screen.getByRole("option", { name: "HOU" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "SS" })).toBeInTheDocument();
  });

  it("fires onFilterChange when a team is selected", async () => {
    const onFilterChange = vi.fn();
    render(
      <PlayerFilterControls
        onFilterChange={onFilterChange}
        availableTeams={["HOU", "LAD"]}
      />
    );
    await userEvent.selectOptions(screen.getByLabelText(/team/i), "LAD");
    expect(onFilterChange).toHaveBeenCalledWith({ team: "LAD" });
  });

  it("fires onFilterChange when typing in the name search", async () => {
    const onFilterChange = vi.fn();
    render(<PlayerFilterControls onFilterChange={onFilterChange} />);
    await userEvent.type(screen.getByLabelText(/name/i), "a");
    expect(onFilterChange).toHaveBeenCalledWith({ search: "a" });
  });

  it("clears filters", async () => {
    const onFilterChange = vi.fn();
    render(
      <PlayerFilterControls
        onFilterChange={onFilterChange}
        availableTeams={["HOU"]}
      />
    );
    await userEvent.selectOptions(screen.getByLabelText(/team/i), "HOU");
    await userEvent.click(screen.getByRole("button", { name: /clear filters/i }));
    expect(onFilterChange).toHaveBeenLastCalledWith({});
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PlayerTable from "../PlayerTable";
import { Player } from "../../types";

const altuve: Player = {
  player_id: 1,
  first_name: "Jose",
  last_name: "Altuve",
  birthdate: "1990-05-06",
  birth_country: "Venezuela",
  birth_state: null,
  height_feet: 5,
  height_inches: 6,
  weight: 166,
  team: "HOU",
  primary_position: "2B",
  throws: "R",
  bats: "R",
};

describe("PlayerTable", () => {
  it("shows loading state", () => {
    render(<PlayerTable players={[]} isLoading />);
    expect(screen.getByText(/loading players/i)).toBeInTheDocument();
  });

  it("shows error state", () => {
    render(<PlayerTable players={[]} error="boom" />);
    expect(screen.getByText(/error: boom/i)).toBeInTheDocument();
  });

  it("shows empty state", () => {
    render(<PlayerTable players={[]} />);
    expect(screen.getByText(/no players found/i)).toBeInTheDocument();
  });

  it("renders player rows with formatted data", () => {
    render(<PlayerTable players={[altuve]} totalCount={1} />);
    expect(screen.getByText("Altuve, Jose")).toBeInTheDocument();
    expect(screen.getByText("HOU")).toBeInTheDocument();
    expect(screen.getByText("2B")).toBeInTheDocument();
    expect(screen.getByText(`5'6"`)).toBeInTheDocument();
  });

  it("invokes onSelectPlayer when a row is clicked", async () => {
    const onSelect = vi.fn();
    render(<PlayerTable players={[altuve]} onSelectPlayer={onSelect} />);
    await userEvent.click(screen.getByText("Altuve, Jose"));
    expect(onSelect).toHaveBeenCalledWith(altuve);
  });
});

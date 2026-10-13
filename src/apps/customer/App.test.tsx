import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import CustomerApp from "./App";

describe("Customer app", () => {
  it("renders the menu screen by default", () => {
    render(<CustomerApp />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});

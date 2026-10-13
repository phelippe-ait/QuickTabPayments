import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import StaffApp from "./App";

describe("Staff app", () => {
  it("renders the table overview by default", () => {
    render(<StaffApp />);
    expect(screen.getByRole("heading", { name: /good evening/i })).toBeInTheDocument();
  });
});

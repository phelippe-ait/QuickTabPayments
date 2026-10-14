import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminApp from "./App";

describe("Admin app", () => {
  it("renders the catalog section by default", () => {
    render(<AdminApp />);
    expect(screen.getByRole("heading", { name: /catalog/i })).toBeInTheDocument();
    expect(screen.getByText("Developed by QuickTab Payments Team")).toBeInTheDocument();
  });
});

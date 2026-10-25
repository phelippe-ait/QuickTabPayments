import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import StaffApp from "./StaffDashboard";

describe("Staff app", () => {
  beforeEach(() => {
    // The welcome heading is derived from the current hour, so pin the clock
    // instead of only passing between 17:00 and 23:59.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 25, 19, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the table overview by default", () => {
    render(<StaffApp />);
    expect(
      screen.getByRole("heading", { name: /good evening/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Developed by QuickTab Payments Team"),
    ).toBeInTheDocument();
  });
});

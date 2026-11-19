import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPill } from "./StatusPill";

describe("StatusPill", () => {
  it("renders its label", () => {
    render(<StatusPill tone="warning">Preparing</StatusPill>);
    expect(screen.getByText("Preparing")).toBeInTheDocument();
  });

  it("renders a dot by default and hides it when withDot is false", () => {
    const { container: withDot } = render(<StatusPill tone="success">Ready</StatusPill>);
    expect(withDot.querySelectorAll("span")).toHaveLength(2);
    const { container: withoutDot } = render(
      <StatusPill tone="success" withDot={false}>
        Ready
      </StatusPill>,
    );
    expect(withoutDot.querySelectorAll("span")).toHaveLength(1);
  });

  it("conveys status with a text label and treats the dot as decorative", () => {
    const { container } = render(<StatusPill tone="success">Ready</StatusPill>);

    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(container.querySelector("span span")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});

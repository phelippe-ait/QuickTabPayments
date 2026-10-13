import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Icon } from "./Icon";

describe("Icon", () => {
  it("renders an svg with the requested size", () => {
    const { container } = render(<Icon name="search" size={24} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("width", "24");
    expect(svg).toHaveAttribute("height", "24");
  });

  it("is decorative (aria-hidden)", () => {
    const { container } = render(<Icon name="cart" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

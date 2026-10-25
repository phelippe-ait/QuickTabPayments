import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button, buttonVariants } from "./Button";

describe("Button", () => {
  it("renders children and defaults to type=button", () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toHaveAttribute("type", "button");
  });

  it("applies the requested variant", () => {
    render(<Button variant="secondary">Cancel</Button>);
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("border-line");
  });

  it("respects fullWidth and disabled", () => {
    render(
      <Button fullWidth disabled>
        Pay
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Pay" });
    expect(btn).toHaveClass("w-full");
    expect(btn).toBeDisabled();
  });

  it("forwards clicks", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    screen.getByRole("button", { name: "Go" }).click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("uses the higher-contrast berry background for filled variants", () => {
    expect(buttonVariants({ variant: "primary" })).toContain("bg-berry-deep");
    expect(buttonVariants({ variant: "danger" })).toContain("bg-berry-deep");
    expect(buttonVariants({ variant: "primary" })).toContain("hover:bg-berry-dark");
  });

  it("buttonVariants is shared with Button", () => {
    render(<Button variant="primary">Both</Button>);
    const classes = buttonVariants({ variant: "primary" });
    expect(screen.getByRole("button", { name: "Both" })).toHaveClass(classes.split(" ")[0]);
  });
});

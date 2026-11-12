import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { RequireFeature, requireFeature } from "./requireFeature"
import type { Plan } from "./features"

const mocks = vi.hoisted(() => ({
  plan: "basic" as Plan,
}))

vi.mock("./usePlan", () => ({
  usePlan: () => ({
    plan: mocks.plan,
    has: () => false,
  }),
}))

describe("requireFeature", () => {
  it("is the plain matrix check", () => {
    expect(requireFeature("basic", "reports")).toBe(false)
    expect(requireFeature("standard", "reports")).toBe(true)
    expect(requireFeature("standard", "multi_location")).toBe(false)
    expect(requireFeature("premium", "multi_location")).toBe(true)
  })
})

describe("RequireFeature", () => {
  beforeEach(() => {
    mocks.plan = "basic"
  })

  it("renders children when the plan includes the feature", () => {
    mocks.plan = "standard"

    render(
      <RequireFeature feature="reports">
        <p>Reports dashboard</p>
      </RequireFeature>,
    )

    expect(screen.getByText("Reports dashboard")).toBeInTheDocument()
    expect(screen.queryByText(/Upgrade to/)).not.toBeInTheDocument()
  })

  it("shows an upgrade panel when the plan does not include the feature", () => {
    render(
      <RequireFeature feature="reports">
        <p>Reports dashboard</p>
      </RequireFeature>,
    )

    expect(screen.queryByText("Reports dashboard")).not.toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Upgrade to Standard" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Reports is included in the Standard plan/),
    ).toBeInTheDocument()
    expect(screen.getByText(/currently on Basic/)).toBeInTheDocument()
    expect(screen.getByText("A$59 / month")).toBeInTheDocument()
    expect(screen.getByText(/handled off-platform/)).toBeInTheDocument()
  })

  it("points premium features at the premium plan and price", () => {
    mocks.plan = "standard"

    render(
      <RequireFeature feature="multi_location">
        <p>Locations</p>
      </RequireFeature>,
    )

    expect(screen.queryByText("Locations")).not.toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Upgrade to Premium" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Multi-location is included in the Premium plan/),
    ).toBeInTheDocument()
    expect(screen.getByText(/currently on Standard/)).toBeInTheDocument()
    expect(screen.getByText("A$99 / month")).toBeInTheDocument()
  })
})

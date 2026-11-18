import { beforeEach, describe, expect, it } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { StaffAssistNotice } from "./StaffAssistNotice"
import {
  CUSTOMER_STAFF_ASSIST_NOTICE,
  STAFF_ASSIST_DISMISSED_KEY,
} from "../../constants"

describe("StaffAssistNotice", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it("renders the centralized staff-assisted ordering copy", () => {
    render(<StaffAssistNotice />)

    expect(screen.getByText(CUSTOMER_STAFF_ASSIST_NOTICE)).toBeInTheDocument()
    expect(
      screen.getByRole("complementary", { name: /ordering with a staff member/i }),
    ).toBeInTheDocument()
  })

  it("can be dismissed and stays hidden for the session", () => {
    const { unmount } = render(<StaffAssistNotice />)

    fireEvent.click(
      screen.getByRole("button", { name: /dismiss staff ordering note/i }),
    )

    expect(
      screen.queryByText(CUSTOMER_STAFF_ASSIST_NOTICE),
    ).not.toBeInTheDocument()
    expect(window.sessionStorage.getItem(STAFF_ASSIST_DISMISSED_KEY)).toBe("1")

    unmount()
    render(<StaffAssistNotice />)
    expect(
      screen.queryByText(CUSTOMER_STAFF_ASSIST_NOTICE),
    ).not.toBeInTheDocument()
  })

  it("respects a dismissal remembered earlier in the session", () => {
    window.sessionStorage.setItem(STAFF_ASSIST_DISMISSED_KEY, "1")

    render(<StaffAssistNotice />)

    expect(
      screen.queryByText(CUSTOMER_STAFF_ASSIST_NOTICE),
    ).not.toBeInTheDocument()
  })
})

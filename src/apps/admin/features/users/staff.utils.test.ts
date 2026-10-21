import { describe, expect, it } from "vitest"
import type { StaffVM } from "../../types"
import { assignableRoles, staffPermissions } from "./staff.utils"

const member: StaffVM = {
  staffId: "staff-2",
  userId: "user-2",
  name: "Maya Johnson",
  email: "maya@example.com",
  initials: "MJ",
  role: "manager",
  isActive: true,
}

describe("staffPermissions", () => {
  it("locks your own row", () => {
    const permissions = staffPermissions({
      viewerRole: "owner",
      viewerUserId: "user-2",
      member,
    })

    expect(permissions.canChangeRole).toBe(false)
    expect(permissions.canRemove).toBe(false)
    expect(permissions.lockedReason).toMatch(/your own access/i)
  })

  it("only lets owners manage an owner row", () => {
    const ownerRow: StaffVM = { ...member, role: "owner" }

    expect(
      staffPermissions({
        viewerRole: "manager",
        viewerUserId: "user-3",
        member: ownerRow,
      }).canRemove,
    ).toBe(false)

    expect(
      staffPermissions({
        viewerRole: "owner",
        viewerUserId: "user-3",
        member: ownerRow,
      }).canRemove,
    ).toBe(true)
  })

  it("allows managers to manage non-owner rows", () => {
    const permissions = staffPermissions({
      viewerRole: "manager",
      viewerUserId: "user-3",
      member,
    })

    expect(permissions.canChangeRole).toBe(true)
    expect(permissions.canToggleActive).toBe(true)
    expect(permissions.canRemove).toBe(true)
  })
})

describe("assignableRoles", () => {
  it("only owners can grant owner access", () => {
    expect(assignableRoles("owner")).toEqual(["owner", "manager", "kitchen"])
    expect(assignableRoles("manager")).toEqual(["manager", "kitchen"])
    expect(assignableRoles("kitchen")).toEqual(["manager", "kitchen"])
  })
})

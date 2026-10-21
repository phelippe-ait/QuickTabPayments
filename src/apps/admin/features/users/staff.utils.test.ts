import { describe, expect, it } from "vitest"
import type { StaffVM } from "../../viewModels"
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
      activeOwnerCount: 1,
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
        activeOwnerCount: 2,
      }).canRemove,
    ).toBe(false)

    expect(
      staffPermissions({
        viewerRole: "owner",
        viewerUserId: "user-3",
        member: ownerRow,
        activeOwnerCount: 2,
      }).canRemove,
    ).toBe(true)
  })

  it("allows managers to manage kitchen rows", () => {
    const kitchenMember: StaffVM = {
      ...member,
      staffId: "staff-3",
      userId: "user-3b",
      role: "kitchen",
    }

    const permissions = staffPermissions({
      viewerRole: "manager",
      viewerUserId: "user-3",
      member: kitchenMember,
      activeOwnerCount: 1,
    })

    expect(permissions.canChangeRole).toBe(true)
    expect(permissions.canToggleActive).toBe(true)
    expect(permissions.canRemove).toBe(true)
  })

  it("blocks managers from managing peer managers", () => {
    const peer: StaffVM = { ...member, staffId: "staff-4", userId: "user-4" }

    const permissions = staffPermissions({
      viewerRole: "manager",
      viewerUserId: "user-3",
      member: peer,
      activeOwnerCount: 1,
    })

    expect(permissions.canChangeRole).toBe(false)
    expect(permissions.canToggleActive).toBe(false)
    expect(permissions.canRemove).toBe(false)
    expect(permissions.lockedReason).toMatch(/other managers/i)
  })

  it("blocks deactivating or demoting the last active owner", () => {
    const soleOwner: StaffVM = {
      ...member,
      staffId: "staff-5",
      userId: "user-5",
      role: "owner",
      isActive: true,
    }

    const permissions = staffPermissions({
      viewerRole: "owner",
      viewerUserId: "user-6",
      member: soleOwner,
      activeOwnerCount: 1,
    })

    expect(permissions.canChangeRole).toBe(false)
    expect(permissions.canToggleActive).toBe(false)
    expect(permissions.canRemove).toBe(false)
    expect(permissions.lockedReason).toMatch(/last active owner/i)
  })

  it("allows owners to manage another owner when multiple are active", () => {
    const otherOwner: StaffVM = {
      ...member,
      staffId: "staff-6",
      userId: "user-6",
      role: "owner",
      isActive: true,
    }

    const permissions = staffPermissions({
      viewerRole: "owner",
      viewerUserId: "user-7",
      member: otherOwner,
      activeOwnerCount: 2,
    })

    expect(permissions.canToggleActive).toBe(true)
  })
})

describe("assignableRoles", () => {
  it("only owners can grant owner access", () => {
    expect(assignableRoles("owner")).toEqual(["owner", "manager", "kitchen"])
    expect(assignableRoles("manager")).toEqual(["manager", "kitchen"])
    expect(assignableRoles("kitchen")).toEqual(["manager", "kitchen"])
  })
})

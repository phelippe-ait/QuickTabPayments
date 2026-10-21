import type { StaffRole } from "@shared/lib/database.types"
import type { StaffVM } from "../../types"

export type StaffPermissions = {
  canChangeRole: boolean
  canToggleActive: boolean
  canRemove: boolean
  lockedReason: string | null
}

/**
 * Row-level rules for the users page. The DB trigger/policy is the final
 * authority; these guards keep impossible actions out of the UI.
 */
export function staffPermissions({
  viewerRole,
  viewerUserId,
  member,
}: {
  viewerRole: StaffRole
  viewerUserId: string
  member: StaffVM
}): StaffPermissions {
  if (member.userId === viewerUserId) {
    return {
      canChangeRole: false,
      canToggleActive: false,
      canRemove: false,
      lockedReason: "You cannot change your own access.",
    }
  }

  if (member.role === "owner" && viewerRole !== "owner") {
    return {
      canChangeRole: false,
      canToggleActive: false,
      canRemove: false,
      lockedReason: "Only the owner can manage an owner.",
    }
  }

  return {
    canChangeRole: true,
    canToggleActive: true,
    canRemove: true,
    lockedReason: null,
  }
}

/** Only owners may grant owner access. */
export function assignableRoles(viewerRole: StaffRole): StaffRole[] {
  return viewerRole === "owner"
    ? ["owner", "manager", "kitchen"]
    : ["manager", "kitchen"]
}

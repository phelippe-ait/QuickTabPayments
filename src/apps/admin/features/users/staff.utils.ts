import type { StaffRole } from "@shared/lib/database.types"
import type { StaffVM } from "../../viewModels"

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
  activeOwnerCount,
}: {
  viewerRole: StaffRole
  viewerUserId: string
  member: StaffVM
  activeOwnerCount: number
}): StaffPermissions {
  if (viewerRole !== "owner" && viewerRole !== "manager") {
    return {
      canChangeRole: false,
      canToggleActive: false,
      canRemove: false,
      lockedReason: "Only owners and managers can manage team access.",
    }
  }

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

  if (member.role === "owner" && member.isActive && activeOwnerCount <= 1) {
    return {
      canChangeRole: false,
      canToggleActive: false,
      canRemove: false,
      lockedReason: "The last active owner cannot be deactivated or demoted.",
    }
  }

  if (viewerRole === "manager" && member.role === "manager") {
    return {
      canChangeRole: false,
      canToggleActive: false,
      canRemove: false,
      lockedReason: "Managers cannot manage other managers.",
    }
  }

  return {
    canChangeRole: true,
    canToggleActive: true,
    canRemove: true,
    lockedReason: null,
  }
}

/**
 * Owners can grant every role. Managers can grant staff/kitchen only; manager
 * and owner grants stay owner-only. Kitchen/staff cannot grant roles.
 */
export function assignableRoles(viewerRole: StaffRole): StaffRole[] {
  if (viewerRole === "owner") return ["owner", "manager", "staff", "kitchen"]
  if (viewerRole === "manager") return ["staff", "kitchen"]
  return []
}

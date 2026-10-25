import { type FormEvent, useState } from "react"
import styles from "../../App.module.css"
import { buttonVariants } from "@shared/ui/Button"
import { AdminModal } from "../../components/AdminModal"
import { roleLabels } from "@shared/restaurant/restaurantHelpers"
import type { StaffRole } from "@shared/lib/database.types"
import type { StaffVM } from "../../viewModels"
import { assignableRoles, staffPermissions } from "./staff.utils"

type UserModalProps = {
  mode: { kind: "edit"; member: StaffVM } | { kind: "add" }
  viewerRole: StaffRole
  viewerUserId: string
  activeOwnerCount: number
  onClose: () => void
  onSaveRole: (staffId: string, role: StaffRole) => Promise<boolean>
  onSetActive: (staffId: string, isActive: boolean) => Promise<boolean>
  onAdd: (email: string, role: StaffRole) => Promise<boolean>
}

export function UserModal({
  mode,
  viewerRole,
  viewerUserId,
  activeOwnerCount,
  onClose,
  onSaveRole,
  onSetActive,
  onAdd,
}: UserModalProps) {
  const editing = mode.kind === "edit"
  const member = editing ? mode.member : null
  const permissions = member
    ? staffPermissions({
        viewerRole,
        viewerUserId,
        member,
        activeOwnerCount,
      })
    : null
  const roleChoices = (
    editing ? assignableRoles(viewerRole) : assignableRoles(viewerRole).filter((role) => role !== "owner")
  ) as StaffRole[]

  const [role, setRole] = useState<StaffRole>(member?.role ?? "manager")
  const [isActive, setIsActive] = useState(member?.isActive ?? true)
  const [email, setEmail] = useState("")
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState("")

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError("")
    setPending(true)

    if (editing && member) {
      let ok = true
      if (role !== member.role) {
        ok = await onSaveRole(member.staffId, role)
      }
      if (ok && isActive !== member.isActive) {
        ok = await onSetActive(member.staffId, isActive)
      }
      setPending(false)
      if (ok) onClose()
      return
    }

    const trimmed = email.trim()
    if (!trimmed) {
      setFormError("Enter the email they signed up with.")
      setPending(false)
      return
    }

    const ok = await onAdd(trimmed, role)
    setPending(false)
    if (ok) onClose()
  }

  return (
    <AdminModal labelledBy="user-modal-title" describedBy="user-modal-description" onClose={onClose} panelClassName={styles["small-modal"]}>
      <form onSubmit={submit}>
        <p className={`${styles["modal-kicker"]}`}>Team access</p>
        <h2 id="user-modal-title">{editing ? `Manage ${member?.name}` : "Add a team member"}</h2>
        <p className={`${styles["modal-description"]}`} id="user-modal-description">
          {editing
            ? "Roles control what this person can see in the admin app."
            : "They must sign up to QuickTab first — this links their existing account."}
        </p>

        {editing && member && permissions ? (
          <div className={`${styles["form-grid"]}`}>
            <label className={`${styles["wide"]}`}>
              Name
              <input value={member.name} readOnly disabled />
            </label>
            <label className={`${styles["wide"]}`}>
              Email
              <input value={member.email} readOnly disabled />
            </label>
            <label>
              Role
              <select
                value={role}
                disabled={!permissions.canChangeRole || pending}
                onChange={(event) => setRole(event.target.value as StaffRole)}
              >
                {roleChoices.map((choice) => (
                  <option key={choice} value={choice}>{roleLabels[choice]}</option>
                ))}
              </select>
            </label>
            <label className={`${styles["switch-row"]}`}>
              <span><strong>Active</strong><small>Inactive members lose access.</small></span>
              <input
                type="checkbox"
                checked={isActive}
                disabled={!permissions.canToggleActive || pending}
                onChange={(event) => setIsActive(event.target.checked)}
              />
            </label>
            {permissions.lockedReason && (
              <p className="text-[11px] text-muted" role="note">{permissions.lockedReason}</p>
            )}
          </div>
        ) : (
          <div className={`${styles["form-grid"]}`}>
            <label className={`${styles["wide"]}`}>
              Email address
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
              />
              <small className="mt-1.5 block text-[10px] font-normal text-muted">
                They must have signed up to QuickTab already.
              </small>
            </label>
            <label className={`${styles["wide"]}`}>
              Role
              <select value={role} onChange={(event) => setRole(event.target.value as StaffRole)}>
                {roleChoices.map((choice) => (
                  <option key={choice} value={choice}>{roleLabels[choice]}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {formError && <p className="mt-3 text-[12px] text-danger" role="alert">{formError}</p>}
        <div className={`${styles["modal-actions"]}`}>
          <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={onClose}>Cancel</button>
          <button className={buttonVariants({ variant: "primary" })} type="submit" disabled={pending}>
            {pending ? "Saving…" : editing ? "Save changes" : "Add team member"}
          </button>
        </div>
      </form>
    </AdminModal>
  )
}

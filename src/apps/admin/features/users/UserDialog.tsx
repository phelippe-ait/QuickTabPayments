import { type FormEvent, useState } from "react"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { buttonVariants } from "@shared/ui/Button"
import type { User } from "../../types"

export function UserModal({ user, onClose, onSave }: { user: User | null; onClose: () => void; onSave: (user: User) => void }) {
  const [form, setForm] = useState<User>(() => user ?? { id: Date.now(), name: "", email: "", role: "Staff", status: "Active", initials: "" })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const initials = form.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()
    onSave({ ...form, initials })
  }
  return (
    <div className={`${styles["modal-backdrop"]}`} onMouseDown={onClose}>
      <form className={`${styles["modal"]} ${styles["small-modal"]}`} onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className={`${styles["modal-close"]}`} onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        <p className={`${styles["modal-kicker"]}`}>Team access</p><h2>{user ? "Edit user" : "Add a new user"}</h2><p className={`${styles["modal-description"]}`}>Create an account and choose its access level.</p>
        <div className={`${styles["form-grid"]}`}>
          <label className={`${styles["wide"]}`}>Full name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Full name" /></label>
          <label className={`${styles["wide"]}`}>Email address<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@cafeshop.co" /></label>
          <label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option>Staff</option><option>Manager</option><option>Admin</option></select></label>
          <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as User["status"] })}><option>Active</option><option>Inactive</option></select></label>
        </div>
        <div className={`${styles["modal-actions"]}`}><button type="button" className={buttonVariants({ variant: "secondary" })} onClick={onClose}>Cancel</button><button className={buttonVariants({ variant: "primary" })} type="submit">{user ? "Save changes" : "Add user"}</button></div>
      </form>
    </div>
  )
}

import { type FormEvent, useState } from "react"
import styles from "../../App.module.css"
import { buttonVariants } from "@shared/ui/Button"
import { AdminModal } from "../../components/AdminModal"
import type { User } from "../../types"

export function UserModal({ user, onClose, onSave }: { user: User | null; onClose: () => void; onSave: (user: User) => void }) {
  const [form, setForm] = useState<User>(() => user ?? { id: Date.now(), name: "", email: "", role: "Staff", status: "Active", initials: "" })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const initials = form.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()
    onSave({ ...form, initials })
  }
  return (
    <AdminModal labelledBy="user-modal-title" describedBy="user-modal-description" onClose={onClose} panelClassName={styles["small-modal"]}>
      <form onSubmit={submit}>
        <p className={`${styles["modal-kicker"]}`}>Team access</p><h2 id="user-modal-title">{user ? "Edit user" : "Add a new user"}</h2><p className={`${styles["modal-description"]}`} id="user-modal-description">Create an account and choose its access level.</p>
        <div className={`${styles["form-grid"]}`}>
          <label className={`${styles["wide"]}`}>Full name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Full name" /></label>
          <label className={`${styles["wide"]}`}>Email address<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@cafeshop.co" /></label>
          <label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option>Staff</option><option>Manager</option><option>Admin</option></select></label>
          <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as User["status"] })}><option>Active</option><option>Inactive</option></select></label>
        </div>
        <div className={`${styles["modal-actions"]}`}><button type="button" className={buttonVariants({ variant: "secondary" })} onClick={onClose}>Cancel</button><button className={buttonVariants({ variant: "primary" })} type="submit">{user ? "Save changes" : "Add user"}</button></div>
      </form>
    </AdminModal>
  )
}

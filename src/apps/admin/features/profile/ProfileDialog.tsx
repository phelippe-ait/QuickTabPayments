import { type FormEvent, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import styles from "../../App.module.css"
import { AdminModal } from "../../components/AdminModal"
import { buttonVariants } from "@shared/ui/Button"
import { useAuth } from "@shared/auth/AuthContext"
import { useRestaurant } from "@shared/restaurant/useRestaurant"
import { restaurantKeys } from "@shared/data/restaurants"
import { useAdminUi } from "../../hooks/AdminUiProvider"

/** Edit the signed-in user's display name (profiles table, own row only). */
export function ProfileDialog({ onClose }: { onClose: () => void }) {
  const { profile, user, updateProfile } = useAuth()
  const { restaurant } = useRestaurant()
  const { notify } = useAdminUi()
  const queryClient = useQueryClient()

  const [firstName, setFirstName] = useState(profile?.first_name ?? "")
  const [lastName, setLastName] = useState(profile?.last_name ?? "")
  const [formError, setFormError] = useState("")
  const [pending, setPending] = useState(false)
  const email = profile?.email ?? user?.email ?? ""

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError("")

    const nextFirst = firstName.trim()
    const nextLast = lastName.trim()
    if (!nextFirst && !nextLast) {
      setFormError("Enter at least a first or last name.")
      return
    }

    setPending(true)
    const { error } = await updateProfile({
      firstName: nextFirst,
      lastName: nextLast,
    })
    setPending(false)

    if (error) {
      setFormError(error.message)
      return
    }

    if (restaurant?.id) {
      void queryClient.invalidateQueries({
        queryKey: restaurantKeys.staff(restaurant.id),
      })
    }
    notify("Profile updated")
    onClose()
  }

  return (
    <AdminModal labelledBy="profile-modal-title" describedBy="profile-modal-description" onClose={onClose} panelClassName={styles["small-modal"]}>
      <form onSubmit={submit}>
        <p className={`${styles["modal-kicker"]}`}>Your account</p>
        <h2 id="profile-modal-title">Profile settings</h2>
        <p className={`${styles["modal-description"]}`} id="profile-modal-description">
          This name appears in the sidebar and the team directory.
        </p>
        <div className={`${styles["form-grid"]}`}>
          <label>
            First name
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              autoComplete="given-name"
              placeholder="Maya"
            />
          </label>
          <label>
            Last name
            <input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              autoComplete="family-name"
              placeholder="Johnson"
            />
          </label>
          <label className={`${styles["wide"]}`}>
            Email
            <input value={email} readOnly disabled />
          </label>
        </div>
        {formError && (
          <p className="mt-3 text-[12px] text-danger" role="alert">{formError}</p>
        )}
        <div className={`${styles["modal-actions"]}`}>
          <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={onClose}>Cancel</button>
          <button className={buttonVariants({ variant: "primary" })} type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </AdminModal>
  )
}

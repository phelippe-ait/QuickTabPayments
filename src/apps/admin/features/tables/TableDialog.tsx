import { type FormEvent, useState } from "react"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { buttonVariants } from "@shared/ui/Button"
import type { CafeTable } from "../../types"

export function TableModal({ table, tables, onClose, onSave }: { table: CafeTable | null; tables: CafeTable[]; onClose: () => void; onSave: (table: CafeTable) => void }) {
  const [form, setForm] = useState<CafeTable>(() => table ? { ...table, seats: table.location === "Pick-up" ? undefined : table.seats ?? 2 } : { id: Date.now(), number: "", available: true, location: "Indoors", seats: 2 })
  const [numberError, setNumberError] = useState("")
  const [seatsError, setSeatsError] = useState("")
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const normalizedNumber = form.number.trim().padStart(2, "0")
    if (tables.some((entry) => entry.id !== form.id && entry.number === normalizedNumber)) {
      setNumberError(`Table ${normalizedNumber} already exists.`)
      return
    }
    if (form.location !== "Pick-up" && (!Number.isInteger(form.seats) || (form.seats ?? 0) < 1 || (form.seats ?? 0) > 12)) {
      setSeatsError("Seats must be a whole number from 1 to 12.")
      return
    }
    onSave({ ...form, number: normalizedNumber, seats: form.location === "Pick-up" ? undefined : form.seats })
  }
  return (
    <div className={`${styles["modal-backdrop"]}`} onMouseDown={onClose}>
      <form className={`${styles["modal"]} ${styles["small-modal"]}`} onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className={`${styles["modal-close"]}`} onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        <p className={`${styles["modal-kicker"]}`}>Seating management</p>
        <h2>{table ? `Edit table ${table.number}` : "Add a new table"}</h2>
        <p className={`${styles["modal-description"]}`}>Set the table identifier, location, and current availability.</p>
        <div className={`${styles["form-grid"]}`}>
          <label className={`${styles["wide"]}`}>
            Table number
            <input
              required
              aria-invalid={Boolean(numberError)}
              aria-describedby={numberError ? "table-number-error" : undefined}
              value={form.number}
              onChange={(event) => {
                setForm({ ...form, number: event.target.value })
                setNumberError("")
              }}
              placeholder="e.g. 07"
            />
            {numberError && <small className={`${styles["field-error"]}`} id="table-number-error">{numberError}</small>}
          </label>
          <label>
            Location
            <select
              value={form.location}
              onChange={(event) => {
                const location = event.target.value as CafeTable["location"]
                setForm({ ...form, location, seats: location === "Pick-up" ? undefined : form.seats ?? 2 })
                setSeatsError("")
              }}
            >
              <option>Indoors</option><option>Outdoors</option><option>Pick-up</option>
            </select>
          </label>
          <label>Status<select value={form.available ? "Available" : "Occupied"} onChange={(event) => setForm({ ...form, available: event.target.value === "Available" })}><option>Available</option><option>Occupied</option></select></label>
          {form.location !== "Pick-up" && (
            <label className={`${styles["wide"]}`}>
              Number of seats
              <input
                required
                type="number"
                min="1"
                max="12"
                step="1"
                inputMode="numeric"
                aria-invalid={Boolean(seatsError)}
                aria-describedby={seatsError ? "table-seats-error" : undefined}
                value={form.seats ?? 2}
                onChange={(event) => {
                  setForm({ ...form, seats: Number(event.target.value) })
                  setSeatsError("")
                }}
              />
              {seatsError && <small className={`${styles["field-error"]}`} id="table-seats-error">{seatsError}</small>}
            </label>
          )}
          <label className={`${styles["switch-row"]} ${styles["wide"]}`}><span><strong>Available to guests</strong><small>Mark this table as ready for seating</small></span><input type="checkbox" checked={form.available} onChange={(event) => setForm({ ...form, available: event.target.checked })} /></label>
        </div>
        <div className={`${styles["modal-actions"]}`}><button type="button" className={buttonVariants({ variant: "secondary" })} onClick={onClose}>Cancel</button><button className={buttonVariants({ variant: "primary" })} type="submit">{table ? "Save changes" : "Add table"}</button></div>
      </form>
    </div>
  )
}

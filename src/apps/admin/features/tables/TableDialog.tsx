import { type FormEvent, useState } from "react"
import styles from "../../App.module.css"
import { buttonVariants } from "@shared/ui/Button"
import { AdminModal } from "../../components/AdminModal"
import type { TablesUpdate } from "@shared/lib/database.types"
import type { NewTableInput } from "../../hooks/useTables"
import type { TableVM } from "../../viewModels"
import { normaliseSeats } from "./table.utils"

const locationSuggestions = ["Indoors", "Outdoors", "Pick-up"]

export function TableModal({
  table,
  onClose,
  onCreate,
  onUpdate,
}: {
  table: TableVM | null
  onClose: () => void
  onCreate: (input: NewTableInput) => Promise<boolean>
  onUpdate: (id: string, patch: TablesUpdate<"tables">) => Promise<boolean>
}) {
  const [number, setNumber] = useState(table?.number ?? "")
  const [locationLabel, setLocationLabel] = useState(table?.locationLabel ?? "Indoors")
  const [seats, setSeats] = useState(table?.seats ? String(table.seats) : "")
  const [isActive, setIsActive] = useState(table?.isActive ?? true)
  const [seatsError, setSeatsError] = useState("")
  const [pending, setPending] = useState(false)

  const isPickUp = locationLabel.trim().toLowerCase() === "pick-up"

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSeatsError("")

    const trimmedNumber = number.trim()
    if (!trimmedNumber) return

    const parsedSeats = normaliseSeats(locationLabel, seats)
    if (
      parsedSeats !== null &&
      (!Number.isInteger(parsedSeats) || parsedSeats < 1 || parsedSeats > 12)
    ) {
      setSeatsError("Seats must be a whole number from 1 to 12.")
      return
    }

    setPending(true)
    const payload = {
      table_number: trimmedNumber,
      location_label: locationLabel.trim() || null,
      seats: parsedSeats,
      is_active: isActive,
    }

    const ok = table
      ? await onUpdate(table.id, payload)
      : await onCreate(payload)

    setPending(false)
    if (ok) onClose()
  }

  return (
    <AdminModal labelledBy="table-modal-title" describedBy="table-modal-description" onClose={onClose} panelClassName={styles["small-modal"]}>
      <form onSubmit={submit}>
        <p className={`${styles["modal-kicker"]}`}>Seating management</p>
        <h2 id="table-modal-title">{table ? `Edit table ${table.number}` : "Add a new table"}</h2>
        <p className={`${styles["modal-description"]}`} id="table-modal-description">Set the table identifier, location, and seat count. Occupancy is derived from open orders.</p>
        <div className={`${styles["form-grid"]}`}>
          <label className={`${styles["wide"]}`}>
            Table number
            <input
              required
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              placeholder="e.g. T07"
            />
          </label>
          <label className={`${styles["wide"]}`}>
            Location label
            <input
              value={locationLabel}
              onChange={(event) => setLocationLabel(event.target.value)}
              placeholder="e.g. Indoors"
            />
            <span className="mt-2 flex flex-wrap gap-1.5">
              {locationSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="rounded-pill border border-line bg-white px-2.5 py-1 text-[10px] font-bold text-muted-2 hover:border-berry hover:text-berry"
                  onClick={() => {
                    setLocationLabel(suggestion)
                    setSeatsError("")
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </span>
          </label>
          <label>
            Seats
            <input
              type="number"
              min="1"
              max="12"
              step="1"
              inputMode="numeric"
              value={isPickUp ? "" : seats}
              disabled={isPickUp}
              aria-invalid={Boolean(seatsError)}
              aria-describedby={seatsError ? "table-seats-error" : undefined}
              onChange={(event) => {
                setSeats(event.target.value)
                setSeatsError("")
              }}
              placeholder={isPickUp ? "Not applicable" : "Optional"}
            />
            {seatsError && <small className={`${styles["field-error"]}`} id="table-seats-error">{seatsError}</small>}
          </label>
          <label className={`${styles["switch-row"]} ${styles["wide"]}`}><span><strong>Enabled for ordering</strong><small>Disabled tables keep their QR code but reject new orders.</small></span><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} /></label>
        </div>
        <div className={`${styles["modal-actions"]}`}>
          <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={onClose}>Cancel</button>
          <button className={buttonVariants({ variant: "primary" })} type="submit" disabled={pending}>
            {pending ? "Saving…" : table ? "Save changes" : "Add table"}
          </button>
        </div>
      </form>
    </AdminModal>
  )
}

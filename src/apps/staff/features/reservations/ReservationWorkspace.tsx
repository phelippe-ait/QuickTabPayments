import { useState } from "react"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { StatusPill } from "@shared/ui/StatusPill"
import { tables } from "../../data/fixtures"
import type { Reservation } from "../../types"

export function ReservationWorkspace({
  reservations,
  onCreate,
  onCancel,
}: {
  reservations: Reservation[]
  onCreate: (reservation: Omit<Reservation, "id" | "status">) => void
  onCancel: (id: number) => void
}) {
  const [reservationView, setReservationView] = useState<"upcoming" | "past">(
    "upcoming",
  )
  const [creating, setCreating] = useState(false)
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null)
  const visibleReservations = reservations.filter(
    (reservation) =>
      reservationView === "upcoming"
        ? reservation.status === "upcoming"
        : reservation.status !== "upcoming",
  )

  return (
    <>
      <section className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className={`${styles["eyebrow"]}`}>Guest book</p>
          <h1 className="mt-2 font-serif text-4xl tracking-[-0.025em] md:text-5xl">
            Reservations
          </h1>
          <p className="mt-2 text-sm text-muted-2">
            Manage arrivals and keep every booking organized.
          </p>
        </div>
        <button
          className="flex items-center justify-center gap-2 rounded-xl bg-berry px-5 py-3.5 text-sm font-bold text-white transition hover:bg-berry-strong"
          onClick={() => setCreating(true)}
        >
          <span className="text-xl font-normal leading-none">+</span>
          New reservation
        </button>
      </section>

      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex w-fit rounded-full border border-line bg-line-soft p-1">
          {(["upcoming", "past"] as const).map((option) => (
            <button
              className={`rounded-full px-5 py-2 text-xs font-bold capitalize transition ${
                reservationView === option
                  ? "bg-white text-ink shadow-sm"
                  : "text-muted-2 hover:text-ink"
              }`}
              key={option}
              onClick={() => setReservationView(option)}
            >
              {option} (
              {
                reservations.filter((reservation) =>
                  option === "upcoming"
                    ? reservation.status === "upcoming"
                    : reservation.status !== "upcoming",
                ).length
              }
              )
            </button>
          ))}
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.13em] text-muted">
          {reservationView === "upcoming"
            ? "Next seating · 7:30 PM"
            : "Reservation archive"}
        </p>
      </div>

      <div className="overflow-hidden rounded-[22px] border border-line bg-paper">
        <div className="hidden grid-cols-[1.5fr_0.8fr_0.8fr_0.9fr_0.8fr] gap-4 border-b border-line-soft bg-cream-2 px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-muted md:grid">
          <span>Guest</span>
          <span>Date</span>
          <span>Time</span>
          <span>Party</span>
          <span>Table</span>
        </div>
        {visibleReservations.map((reservation) => (
          <button
            aria-label={`View reservation for ${reservation.guest}`}
            className="group grid w-full grid-cols-[1fr_auto] gap-x-4 gap-y-3 border-b border-line-soft px-5 py-5 text-left transition last:border-0 hover:bg-cream-3 focus-visible:bg-cream-3 focus-visible:outline-2 focus-visible:outline-berry focus-visible:outline-offset-[-2px] md:grid-cols-[1.5fr_0.8fr_0.8fr_0.9fr_0.8fr] md:items-center md:gap-4 md:px-6"
            key={reservation.id}
            onClick={() => setSelectedReservation(reservation)}
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold">{reservation.guest}</p>
                {reservation.status === "cancelled" && (
                  <span className="rounded-full bg-sand px-2 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-muted-2">
                    Cancelled
                  </span>
                )}
              </div>
              {reservation.notes && (
                <p className="mt-1 text-xs text-muted">
                  {reservation.notes}
                </p>
              )}
            </div>
            <span className="row-start-2 text-xs text-muted-2 md:row-auto md:text-sm">
              {reservation.date}
            </span>
            <span className="row-start-2 font-serif text-lg md:row-auto">
              {reservation.time}
            </span>
            <span className="flex items-center gap-1.5 text-xs font-bold text-ink-mid md:text-sm">
              <Icon name="users" size={15} />
              {reservation.guests} guests
            </span>
            <span className="text-right text-xs text-muted-2 md:text-left">
              {reservation.table ?? "Unassigned"}
            </span>
          </button>
        ))}
      </div>
      <p className="pb-16 pt-4 text-xs text-muted lg:pb-0">
        Showing {visibleReservations.length} {reservationView} reservations
      </p>

      {creating && (
        <NewReservationDrawer
          onClose={() => setCreating(false)}
          onCreate={(reservation) => {
            onCreate(reservation)
            setReservationView("upcoming")
            setCreating(false)
          }}
        />
      )}
      {selectedReservation && (
        <ReservationDetailDrawer
          reservation={selectedReservation}
          onClose={() => setSelectedReservation(null)}
          onCancel={() => {
            onCancel(selectedReservation.id)
            setSelectedReservation(null)
            setReservationView("past")
          }}
        />
      )}
    </>
  )
}

function NewReservationDrawer({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (reservation: Omit<Reservation, "id" | "status">) => void
}) {
  const [guest, setGuest] = useState("")
  const [date, setDate] = useState("Today")
  const [time, setTime] = useState("7:30 PM")
  const [guests, setGuests] = useState(2)
  const [table, setTable] = useState("")
  const [notes, setNotes] = useState("")

  function submitReservation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!guest.trim()) return
    onCreate({
      guest: guest.trim(),
      date,
      time,
      guests,
      table: table || undefined,
      notes: notes.trim() || undefined,
    })
  }

  const fieldClass =
    "mt-2.5 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-berry focus:ring-2 focus:ring-berry/10"

  return (
    <>
      <button
        aria-label="Close new reservation"
        className="fixed inset-0 z-40 cursor-default bg-ink/20 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside className={`${styles["drawer-scroll"]} fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-paper p-6 shadow-2xl sm:w-[460px] sm:p-8`}>
        <div className="flex items-center justify-between">
          <p className={`${styles["eyebrow"]}`}>New booking</p>
          <button
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full border border-line hover:bg-cream-2"
            onClick={onClose}
          >
            <Icon name="close" size={17} />
          </button>
        </div>
        <div className="mt-8 border-b border-line pb-7">
          <h2 className="font-serif text-4xl">Create reservation</h2>
          <p className="mt-2 text-sm text-muted-2">
            Add the guest’s details and seating preferences.
          </p>
        </div>

        <form className="mt-7 space-y-6" onSubmit={submitReservation}>
          <label className="block">
            <span className={`${styles["detail-label"]}`}>Guest or party name</span>
            <input
              autoFocus
              className={fieldClass}
              onChange={(event) => setGuest(event.target.value)}
              placeholder="Enter guest name"
              required
              value={guest}
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className={`${styles["detail-label"]}`}>Date</span>
              <select
                className={fieldClass}
                onChange={(event) => setDate(event.target.value)}
                value={date}
              >
                <option>Today</option>
                <option>Tomorrow</option>
                <option>Saturday, May 26</option>
                <option>Sunday, May 27</option>
              </select>
            </label>
            <label className="block">
              <span className={`${styles["detail-label"]}`}>Time</span>
              <input
                className={fieldClass}
                onChange={(event) => setTime(event.target.value)}
                placeholder="7:30 PM"
                required
                value={time}
              />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className={`${styles["detail-label"]}`}>Guests</span>
              <span className="text-xs text-muted">Party size</span>
            </div>
            <div className="mt-2.5 flex items-center justify-between rounded-xl border border-line bg-white p-2">
              <button
                aria-label="Decrease guests"
                className="grid h-10 w-10 place-items-center rounded-lg bg-cream-2 text-xl transition hover:bg-line-soft disabled:opacity-40"
                disabled={guests <= 1}
                onClick={() => setGuests((current) => Math.max(1, current - 1))}
                type="button"
              >
                −
              </button>
              <strong className="font-serif text-2xl font-normal">
                {guests}
              </strong>
              <button
                aria-label="Increase guests"
                className="grid h-10 w-10 place-items-center rounded-lg bg-cream-2 text-xl transition hover:bg-line-soft"
                onClick={() => setGuests((current) => current + 1)}
                type="button"
              >
                +
              </button>
            </div>
          </div>

          <label className="block">
            <span className={`${styles["detail-label"]}`}>Table</span>
            <select
              className={fieldClass}
              onChange={(event) => setTable(event.target.value)}
              value={table}
            >
              <option value="">Unassigned</option>
              {tables.map((item) => (
                <option key={item.id}>Table {item.id}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={`${styles["detail-label"]}`}>Notes</span>
            <textarea
              className={`${fieldClass} min-h-24 resize-none`}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Dietary needs, occasion, seating preference..."
              value={notes}
            />
          </label>

          <button
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-berry py-3.5 text-sm font-bold text-white transition hover:bg-berry-strong"
            type="submit"
          >
            <Icon name="check" size={16} />
            Create reservation
          </button>
        </form>
      </aside>
    </>
  )
}

function ReservationDetailDrawer({
  reservation,
  onClose,
  onCancel,
}: {
  reservation: Reservation
  onClose: () => void
  onCancel: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const isUpcoming = reservation.status === "upcoming"
  const isCancelled = reservation.status === "cancelled"

  return (
    <>
      <button
        aria-label="Close reservation details"
        className="fixed inset-0 z-40 cursor-default bg-ink/20 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside className={`${styles["drawer-scroll"]} fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-paper p-6 shadow-2xl sm:w-[440px] sm:p-8`}>
        <div className="flex items-center justify-between">
          <p className={`${styles["eyebrow"]}`}>Reservation details</p>
          <button
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full border border-line hover:bg-cream-2"
            onClick={onClose}
          >
            <Icon name="close" size={17} />
          </button>
        </div>

        <div className="mt-8 flex items-start justify-between border-b border-line pb-7">
          <div>
            <h2 className="font-serif text-4xl">{reservation.guest}</h2>
            <p className="mt-2 text-sm text-muted-2">
              {reservation.date} · {reservation.time}
            </p>
          </div>
          <StatusPill tone={isCancelled ? "danger" : "success"}>
            {isCancelled ? "Cancelled" : isUpcoming ? "Upcoming" : "Completed"}
          </StatusPill>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-cream-2 p-4">
            <p className={`${styles["detail-label"]}`}>Party size</p>
            <p className="mt-2 flex items-center gap-2 text-sm font-bold">
              <Icon name="users" size={16} />
              {reservation.guests} guests
            </p>
          </div>
          <div className="rounded-2xl bg-cream-2 p-4">
            <p className={`${styles["detail-label"]}`}>Table</p>
            <p className="mt-2 text-sm font-bold">
              {reservation.table ?? "Unassigned"}
            </p>
          </div>
        </div>

        {reservation.notes && (
          <div className="mt-6 rounded-2xl border border-line-soft bg-white p-4">
            <p className={`${styles["detail-label"]}`}>Guest notes</p>
            <p className="mt-2 text-sm leading-6 text-ink-mid">
              {reservation.notes}
            </p>
          </div>
        )}

        {isUpcoming && !confirming && (
          <button
            className="mt-8 w-full rounded-xl border border-[#d7aab2] bg-white py-3.5 text-sm font-bold text-berry-strong transition hover:bg-berry-soft"
            onClick={() => setConfirming(true)}
          >
            Cancel reservation
          </button>
        )}

        {isUpcoming && confirming && (
          <div className="mt-8 rounded-2xl border border-[#e4bdc4] bg-berry-soft p-5">
            <p className="text-sm font-bold text-[#9f394d]">
              Cancel this reservation?
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-2">
              It will be removed from Upcoming and moved to the Past list as
              cancelled.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                className="rounded-xl border border-line bg-white py-3 text-xs font-bold"
                onClick={() => setConfirming(false)}
              >
                Keep booking
              </button>
              <button
                className="rounded-xl bg-berry-strong py-3 text-xs font-bold text-white transition hover:bg-[#9f394d]"
                onClick={onCancel}
              >
                Yes, cancel
              </button>
            </div>
          </div>
        )}

        {!isUpcoming && (
          <button
            className="mt-8 w-full rounded-xl border border-line bg-white py-3.5 text-sm font-bold transition hover:border-berry hover:text-berry-strong"
            onClick={onClose}
          >
            Close details
          </button>
        )}
      </aside>
    </>
  )
}


/** Mirrors the public.table_status enum added in migration 0025 (P06). */
export type TableStatus = "available" | "occupied" | "needs_cleaning"
export type KitchenStatus = "New" | "Preparing" | "Ready" | "Completed" | "Cancelled"
export type View = "tables" | "kitchen" | "history" | "reservations"

export type Table = {
  id: string | number
  tableNumber?: string
  locationLabel?: string | null
  seats?: number
  occupants: number
  status: TableStatus
  guest?: string
  since?: string
  total?: number
  items?: number
}

export type Order = {
  id: string
  databaseId?: string
  table: string
  guest: string
  time: string
  /** ISO timestamp used by the kitchen board for SLA elapsed time + sorting. */
  createdAt?: string
  total: number
  subtotal?: number
  tax?: number
  /** Tip added on top of the items total; no GST on the tip. */
  tipAmount?: number
  /** `total + tipAmount` — the amount charged. */
  amountDue?: number
  status: "In progress" | "Completed" | "Cancelled"
  kitchenStatus: KitchenStatus
  server: string
  guests: number
  payment: string
  items: {
    name: string
    qty: number
    price: number
    modifiers?: string[]
    /** Menu-item allergens snapshotted from the menu at read time. */
    allergens?: string[]
  }[]
}

export type Reservation = {
  id: number
  guest: string
  date: string
  time: string
  guests: number
  table?: string
  status: "upcoming" | "past" | "cancelled"
  notes?: string
}

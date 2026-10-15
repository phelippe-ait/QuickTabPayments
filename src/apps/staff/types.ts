export type TableStatus = "occupied" | "available"
export type KitchenStatus = "New" | "Preparing" | "Ready" | "Completed" | "Cancelled"
export type View = "tables" | "kitchen" | "history" | "reservations"

export type Table = {
  id: number
  seats: number
  occupants: number
  status: TableStatus
  guest?: string
  since?: string
  total?: number
  items?: number
}

export type Order = {
  id: string
  table: string
  guest: string
  time: string
  total: number
  status: "In progress" | "Completed" | "Cancelled"
  kitchenStatus: KitchenStatus
  server: string
  guests: number
  payment: string
  items: { name: string; qty: number; price: number }[]
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

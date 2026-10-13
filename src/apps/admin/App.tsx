import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import QRCode from "qrcode"
import styles from "./App.module.css";
import { Icon } from "@shared/ui/Icon";

type Section = "catalog" | "tables" | "users" | "orders"
type MenuItem = {
  id: number
  name: string
  category: string
  description: string
  price: number
  image: string
  available: boolean
}

type User = {
  id: number
  name: string
  email: string
  role: string
  status: "Active" | "Inactive"
  initials: string
}

type CafeTable = {
  id: number
  number: string
  available: boolean
  location: "Indoors" | "Outdoors" | "Pick-up"
  seats?: number
  currentOrder?: string
  seatedAt?: string
}

type Confirmation = {
  title: string
  description: string
  actionLabel: string
  onConfirm: () => void
}

const starterItems: MenuItem[] = [
  {
    id: 1,
    name: "Flat White",
    category: "Hot Beverages",
    description: "Smooth, creamy, and just the right amount of coffee kick.",
    price: 4.7,
    image: "/menu/flat-white.jpg",
    available: true,
  },
  {
    id: 2,
    name: "Babyccino",
    category: "Hot Beverages",
    description: "Steamed milk topped with a gentle sprinkle of cocoa.",
    price: 2.5,
    image: "/menu/babyccino.jpg",
    available: true,
  },
  {
    id: 3,
    name: "Mocha",
    category: "Hot Beverages",
    description: "Espresso, chocolate, and steamed milk. A sweet indulgence.",
    price: 5,
    image: "/menu/mocha.jpg",
    available: true,
  },
  {
    id: 4,
    name: "Cappuccino",
    category: "Hot Beverages",
    description: "Silky, rich, with a generous cap of velvety foam.",
    price: 4.5,
    image: "/menu/cappuccino.jpg",
    available: false,
  },
  {
    id: 5,
    name: "Ceremonial Matcha",
    category: "Breakfast",
    description: "Premium matcha whisked with your choice of milk.",
    price: 5.8,
    image: "/menu/matcha.jpg",
    available: true,
  },
]

const starterUsers: User[] = [
  { id: 1, name: "Maya Johnson", email: "maya@cafeshop.co", role: "Manager", status: "Active", initials: "MJ" },
  { id: 2, name: "Theo Martin", email: "theo@cafeshop.co", role: "Staff", status: "Active", initials: "TM" },
  { id: 3, name: "Isla Chen", email: "isla@cafeshop.co", role: "Staff", status: "Active", initials: "IC" },
  { id: 4, name: "Noah Williams", email: "noah@cafeshop.co", role: "Staff", status: "Inactive", initials: "NW" },
]

const starterTables: CafeTable[] = [
  { id: 1, number: "01", available: true, location: "Indoors", seats: 2 },
  { id: 2, number: "02", available: false, location: "Indoors", seats: 4, currentOrder: "#1051", seatedAt: "18 min ago" },
  { id: 3, number: "03", available: true, location: "Indoors", seats: 2 },
  { id: 4, number: "04", available: true, location: "Outdoors", seats: 4 },
  { id: 5, number: "05", available: false, location: "Outdoors", seats: 6, currentOrder: "#1050", seatedAt: "34 min ago" },
  { id: 6, number: "06", available: true, location: "Outdoors", seats: 2 },
  { id: 7, number: "Pick-up", available: true, location: "Pick-up" },
]

const starterOrders = [
  { id: "#1048", table: "02", customer: "Olivia Moore", items: "2 items", date: `Today, ${new Date(Date.now() - 18 * 60 * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`, total: "$12.40", status: "Active", payment: "Visa •••• 4242", refundedAmount: 0, lineItems: [{ name: "Flat White", quantity: 2, price: "$9.40", image: "/menu/flat-white.jpg" }, { name: "Babyccino", quantity: 1, price: "$2.50", image: "/menu/babyccino.jpg" }] },
  { id: "#1047", table: "03", customer: "James Smith", items: "3 items", date: "Today, 9:18 AM", total: "$18.20", status: "Completed", payment: "Mastercard •••• 1881", refundedAmount: 0, lineItems: [{ name: "Cappuccino", quantity: 2, price: "$9.00", image: "/menu/cappuccino.jpg" }, { name: "Mocha", quantity: 1, price: "$5.00", image: "/menu/mocha.jpg" }, { name: "Ceremonial Matcha", quantity: 1, price: "$4.20", image: "/menu/matcha.jpg" }] },
  { id: "#1046", table: "05", customer: "Emma Davis", items: "1 item", date: "Yesterday, 4:32 PM", total: "$5.80", status: "Completed", payment: "Visa •••• 6038", refundedAmount: 5.8, lineItems: [{ name: "Ceremonial Matcha", quantity: 1, price: "$5.80", image: "/menu/matcha.jpg" }] },
  { id: "#1045", table: "01", customer: "Liam Wilson", items: "4 items", date: "Yesterday, 1:05 PM", total: "$26.90", status: "Canceled", payment: "Apple Pay", refundedAmount: 0, lineItems: [{ name: "Flat White", quantity: 2, price: "$9.40", image: "/menu/flat-white.jpg" }, { name: "Mocha", quantity: 2, price: "$10.00", image: "/menu/mocha.jpg" }, { name: "Babyccino", quantity: 1, price: "$2.50", image: "/menu/babyccino.jpg" }, { name: "Cappuccino", quantity: 1, price: "$5.00", image: "/menu/cappuccino.jpg" }] },
  { id: "#1044", table: "04", customer: "Sophia Brown", items: "2 items", date: "May 21, 11:48 AM", total: "$9.40", status: "Completed", payment: "Visa •••• 0914", refundedAmount: 0, lineItems: [{ name: "Flat White", quantity: 1, price: "$4.70", image: "/menu/flat-white.jpg" }, { name: "Cappuccino", quantity: 1, price: "$4.70", image: "/menu/cappuccino.jpg" }] },
]

function getOrderDate(value: string) {
  const currentDate = new Date()
  const [dateLabel, timeLabel] = value.split(", ")
  const orderDate = dateLabel === "Today"
    ? new Date(currentDate)
    : dateLabel === "Yesterday"
      ? new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 1)
      : new Date(`${dateLabel}, ${currentDate.getFullYear()}`)
  const timeMatch = timeLabel?.match(/(\d+):(\d+) (AM|PM)/)
  if (timeMatch) {
    const hours = (Number(timeMatch[1]) % 12) + (timeMatch[3] === "PM" ? 12 : 0)
    orderDate.setHours(hours, Number(timeMatch[2]), 0, 0)
  }
  return orderDate
}

function formatRunningTime(value: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - getOrderDate(value).getTime()) / 60000))
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function getRefundStatus(order: { total: string; refundedAmount: number }) {
  if (order.refundedAmount <= 0) return null
  return order.refundedAmount >= Number(order.total.replace("$", "")) ? "Refunded" : "Partial refund"
}


function SelectionBar({ count, children, onClear }: { count: number; children: React.ReactNode; onClear: () => void }) {
  return (
    <div className={`${styles["selection-bar"]}`}>
      <strong>{count} selected</strong>
      <div>{children}</div>
      <button type="button" onClick={onClear}>Clear selection</button>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className={`${styles["empty-state"]}`}>
      <span><Icon name="search" size={22} /></span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  )
}

function ConfirmDialog({ confirmation, onClose }: { confirmation: Confirmation; onClose: () => void }) {
  return (
    <div className={`${styles["modal-backdrop"]} ${styles["confirmation-backdrop"]}`} onMouseDown={onClose}>
      <section className={`${styles["modal"]} ${styles["confirmation-modal"]}`} role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" onMouseDown={(event) => event.stopPropagation()}>
        <p className={`${styles["modal-kicker"]}`}>Please confirm</p>
        <h2 id="confirmation-title">{confirmation.title}</h2>
        <p className={`${styles["modal-description"]}`}>{confirmation.description}</p>
        <div className={`${styles["modal-actions"]}`}>
          <button type="button" className={`${styles["secondary-button"]}`} onClick={onClose}>Cancel</button>
          <button
            type="button"
            className={`${styles["danger-button"]}`}
            onClick={() => {
              confirmation.onConfirm()
              onClose()
            }}
          >
            {confirmation.actionLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

function Catalog({
  items,
  sections,
  onAdd,
  onEdit,
  onDelete,
  onBulkAvailability,
  onBulkDelete,
  onManageSections,
}: {
  items: MenuItem[]
  sections: string[]
  onAdd: () => void
  onEdit: (item: MenuItem) => void
  onDelete: (id: number) => void
  onBulkAvailability: (ids: number[], available: boolean) => void
  onBulkDelete: (ids: number[]) => void
  onManageSections: () => void
}) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("All items")
  const [selected, setSelected] = useState<number[]>([])
  const categories = ["All items", ...sections]
  const visible = items.filter(
    (item) =>
      (category === "All items" || item.category === category) &&
      item.name.toLowerCase().includes(query.toLowerCase()),
  )
  useEffect(() => setSelected((current) => current.filter((id) => items.some((item) => item.id === id))), [items])

  return (
    <>
      <PageHeader eyebrow="Menu management" title="Catalog" description="Add, update, and organize the items your guests can order." action="Add menu item" onAction={onAdd} />
      <div className={`${styles["toolbar"]}`}>
        <label className={`${styles["search-box"]}`}><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search menu items" /></label>
        <div className={`${styles["section-tools"]}`}>
          <div className={`${styles["filter-pills"]}`}>
            {categories.map((item) => <button key={item} className={category === item ? styles["active"] : ""} onClick={() => setCategory(item)}>{item}</button>)}
          </div>
          <button className={`${styles["manage-sections"]}`} onClick={onManageSections}><Icon name="edit" size={14} />Manage sections</button>
        </div>
      </div>
      {selected.length > 0 && (
        <SelectionBar count={selected.length} onClear={() => setSelected([])}>
          <button type="button" onClick={() => onBulkAvailability(selected, true)}>Mark available</button>
          <button type="button" onClick={() => onBulkAvailability(selected, false)}>Mark unavailable</button>
          <button type="button" className={`${styles["danger"]}`} onClick={() => onBulkDelete(selected)}>Delete</button>
        </SelectionBar>
      )}
      {visible.length === 0 ? (
        <EmptyState title="No menu items found" description="Try changing your search or section filter." />
      ) : <div className={`${styles["catalog-grid"]}`}>
        {visible.map((item) => (
          <article className={`${styles["menu-card"]} ${selected.includes(item.id) ? styles["selected"] : ""}`} key={item.id}>
            <div className={`${styles["menu-image"]}`}>
              <img src={item.image} alt="" />
              <label className={`${styles["card-select"]}`} aria-label={`Select ${item.name}`}>
                <input type="checkbox" checked={selected.includes(item.id)} onChange={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} />
              </label>
              <span className={`${styles["availability"]} ${item.available ? "" : styles["unavailable"]}`}>{item.available ? "Available" : "Unavailable"}</span>
              <div className={`${styles["card-actions"]}`}>
                <button aria-label={`Edit ${item.name}`} onClick={() => onEdit(item)}><Icon name="edit" size={16} /></button>
                <button className={`${styles["danger"]}`} aria-label={`Delete ${item.name}`} onClick={() => onDelete(item.id)}><Icon name="trash" size={16} /></button>
              </div>
            </div>
            <div className={`${styles["menu-copy"]}`}>
              <p className={`${styles["category-label"]}`}>{item.category}</p>
              <div className={`${styles["name-price"]}`}><h3>{item.name}</h3><strong>${item.price.toFixed(2)}</strong></div>
              <p>{item.description}</p>
            </div>
          </article>
        ))}
        <button className={`${styles["add-card"]}`} onClick={onAdd}><span><Icon name="plus" size={22} /></span><strong>Add a new item</strong><small>Expand your café menu</small></button>
      </div>}
    </>
  )
}

function TablesView({
  tables,
  onAdd,
  onEdit,
  onDelete,
  onToggleAvailability,
  onBulkAvailability,
  onBulkDelete,
  onNotify,
}: {
  tables: CafeTable[]
  onAdd: () => void
  onEdit: (table: CafeTable) => void
  onDelete: (id: number) => void
  onToggleAvailability: (id: number) => void
  onBulkAvailability: (ids: number[], available: boolean) => void
  onBulkDelete: (ids: number[]) => void
  onNotify: (message: string) => void
}) {
  const [location, setLocation] = useState("All tables")
  const [selected, setSelected] = useState<number[]>([])
  const visible = tables.filter((table) => location === "All tables" || table.location === location)
  const available = tables.filter((table) => table.available).length
  useEffect(() => setSelected((current) => current.filter((id) => tables.some((table) => table.id === id))), [tables])
  const downloadQrSheet = async () => {
    const cards = await Promise.all(tables.map(async (table) => {
      const source = await QRCode.toDataURL(getTableUrl(table.number), { width: 360, margin: 2 })
      return `<article><img src="${source}" alt=""><h2>Table ${table.number}</h2><p>${table.location}</p></article>`
    }))
    const sheet = `<!doctype html><html><head><meta charset="utf-8"><title>Café Shop table QR codes</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#37333a}header{text-align:center;margin-bottom:28px}main{display:grid;grid-template-columns:repeat(2,1fr);gap:24px}article{break-inside:avoid;text-align:center;border:1px solid #ddd;border-radius:16px;padding:24px}img{width:220px;height:220px}h2{margin:12px 0 4px}p{margin:0;color:#777}@media print{body{margin:12mm}article{border-color:#bbb}}</style></head><body><header><h1>Café Shop</h1><p>Scan to order</p></header><main>${cards.join("")}</main></body></html>`
    const downloadUrl = URL.createObjectURL(new Blob([sheet], { type: "text/html;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = downloadUrl
    link.download = "cafe-shop-table-qr-codes.html"
    link.click()
    URL.revokeObjectURL(downloadUrl)
    onNotify("Printable QR sheet downloaded")
  }
  return (
    <>
      <PageHeader eyebrow="Seating management" title="Tables" description="Manage your café seating, location, and live availability." action="Add table" onAction={onAdd} />
      <div className={`${styles["table-overview"]}`}>
        <div><span>Total tables</span><strong>{tables.length}</strong></div>
        <div><span>Available now</span><strong>{available}</strong></div>
        <div><span>Currently occupied</span><strong>{tables.length - available}</strong></div>
      </div>
      <div className={`${styles["toolbar"]} table-toolbar`}>
        <div className={`${styles["filter-pills"]}`}>
          {["All tables", "Indoors", "Outdoors", "Pick-up"].map((item) => <button key={item} className={location === item ? styles["active"] : ""} onClick={() => setLocation(item)}>{item}</button>)}
        </div>
        <div className={`${styles["table-toolbar-actions"]}`}>
          <span>{visible.length} {visible.length === 1 ? "table" : "tables"}</span>
          <button type="button" className={`${styles["manage-sections"]}`} onClick={downloadQrSheet}><Icon name="download" size={14} />Download QR sheet</button>
        </div>
      </div>
      {selected.length > 0 && (
        <SelectionBar count={selected.length} onClear={() => setSelected([])}>
          <button type="button" onClick={() => onBulkAvailability(selected, true)}>Mark available</button>
          <button type="button" onClick={() => onBulkAvailability(selected, false)}>Mark occupied</button>
          <button type="button" className={`${styles["danger"]}`} onClick={() => onBulkDelete(selected)}>Delete</button>
        </SelectionBar>
      )}
      {visible.length === 0 ? (
        <EmptyState title="No tables found" description="Try another location filter or add a new table." />
      ) : <div className={`${styles["tables-grid"]}`}>
        {visible.map((table) => (
          <article className={`${styles["table-card-item"]} ${selected.includes(table.id) ? styles["selected"] : ""}`} key={table.id}>
            <div className={`${styles["table-card-top"]}`}>
              <label className={`${styles["inline-select"]}`} aria-label={`Select table ${table.number}`}><input type="checkbox" checked={selected.includes(table.id)} onChange={() => setSelected((current) => current.includes(table.id) ? current.filter((id) => id !== table.id) : [...current, table.id])} /></label>
              <button type="button" className={`${styles["table-state"]} ${table.available ? styles["available"] : styles["occupied"]}`} onClick={() => onToggleAvailability(table.id)} title={`Mark table ${table.number} ${table.available ? "occupied" : "available"}`}><i />{table.available ? "Available" : "Occupied"}</button>
              <div className={`${styles["row-actions"]}`}>
                <button aria-label={`Edit table ${table.number}`} onClick={() => onEdit(table)}><Icon name="edit" size={16} /></button>
                <button aria-label={`Delete table ${table.number}`} onClick={() => onDelete(table.id)}><Icon name="trash" size={16} /></button>
              </div>
            </div>
            <div className={`${styles["table-card-content"]}`}>
              <div className={`${styles["table-illustration"]}`}>
                <span><Icon name="tables" size={28} /></span>
                <small>Table</small>
                <strong>{table.number}</strong>
              </div>
              <TableQrCode tableNumber={table.number} onNotify={onNotify} />
            </div>
            {!table.available && <div className={`${styles["active-seating"]}`}><span>Current order <strong>{table.currentOrder ?? "Awaiting order"}</strong></span><span>Seated <strong>{table.seatedAt ?? "Just now"}</strong></span></div>}
            <div className={`${styles["table-location"]}`}>
              <div><span>Location</span><strong>{table.location}</strong></div>
              {table.location !== "Pick-up" && <div><span>Seats</span><strong>{table.seats ?? 2}</strong></div>}
            </div>
          </article>
        ))}
      </div>}
    </>
  )
}

function getTableUrl(tableNumber: string) {
  const tableUrl = new URL(window.location.origin)
  tableUrl.searchParams.set("table", tableNumber)
  return tableUrl.toString()
}

function TableQrCode({ tableNumber, onNotify }: { tableNumber: string; onNotify: (message: string) => void }) {
  const [source, setSource] = useState("")
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    let active = true
    QRCode.toDataURL(getTableUrl(tableNumber), {
      width: 180,
      margin: 1,
      color: { dark: "#37333A", light: "#FFFFFF" },
    }).then((dataUrl) => {
      if (active) setSource(dataUrl)
    })
    return () => {
      active = false
    }
  }, [tableNumber])

  const downloadQrCode = () => {
    const link = document.createElement("a")
    link.href = source
    link.download = `table-${tableNumber}-qr.png`
    link.click()
    onNotify(`Table ${tableNumber} QR code downloaded`)
  }

  return (
    <div className={`${styles["table-qr"]}`}>
      {source ? <button type="button" className={`${styles["qr-preview-trigger"]}`} onClick={() => setPreviewOpen(true)}><img src={source} alt={`QR code for table ${tableNumber}`} /></button> : <span className={`${styles["qr-placeholder"]}`} />}
      <small>Scan to order</small>
      <button className={`${styles["qr-download"]}`} type="button" disabled={!source} onClick={downloadQrCode}>
        <Icon name="download" size={12} />
        Download
      </button>
      {previewOpen && createPortal(
        <div className={`${styles["modal-backdrop"]}`} onMouseDown={() => setPreviewOpen(false)}>
          <section className={`${styles["modal"]} ${styles["qr-modal"]}`} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className={`${styles["modal-close"]}`} onClick={() => setPreviewOpen(false)} aria-label="Close QR preview"><Icon name="close" /></button>
            <p className={`${styles["modal-kicker"]}`}>Table ordering</p>
            <h2>Table {tableNumber}</h2>
            <p className={`${styles["modal-description"]}`}>Guests can scan this code to start an order assigned to this table.</p>
            <img src={source} alt={`Large QR code for table ${tableNumber}`} />
            <code>{getTableUrl(tableNumber)}</code>
            <div className={`${styles["modal-actions"]}`}>
              <button type="button" className={`${styles["secondary-button"]}`} onClick={async () => { await navigator.clipboard.writeText(getTableUrl(tableNumber)); onNotify("Table link copied") }}>Copy link</button>
              <button type="button" className={`${styles["primary-button"]}`} onClick={downloadQrCode}><Icon name="download" size={15} />Download PNG</button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </div>
  )
}

function UsersView({
  users,
  onAdd,
  onEdit,
  onDelete,
  onBulkStatus,
  onBulkDelete,
}: {
  users: User[]
  onAdd: () => void
  onEdit: (user: User) => void
  onDelete: (id: number) => void
  onBulkStatus: (ids: number[], status: User["status"]) => void
  onBulkDelete: (ids: number[]) => void
}) {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("All statuses")
  const [role, setRole] = useState("All roles")
  const [selected, setSelected] = useState<number[]>([])
  const roles = [...new Set(users.map((user) => user.role))].sort()
  const visible = users.filter(
    (user) =>
      `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase()) &&
      (status === "All statuses" || user.status === status) &&
      (role === "All roles" || user.role === role),
  )
  useEffect(() => setSelected((current) => current.filter((id) => users.some((user) => user.id === id))), [users])
  return (
    <>
      <PageHeader eyebrow="Team access" title="Users" description="Create user accounts and manage access to Café Shop." action="Add user" onAction={onAdd} />
      <div className={`${styles["toolbar"]} user-toolbar`}>
        <label className={`${styles["search-box"]}`}><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users" /></label>
        <div className={`${styles["user-filters"]}`}>
          <label className={`${styles["filter-select"]}`}>
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option>All statuses</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </label>
          <label className={`${styles["filter-select"]}`}>
            <span>Role</span>
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option>All roles</option>
              {roles.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </div>
      {selected.length > 0 && (
        <SelectionBar count={selected.length} onClear={() => setSelected([])}>
          <button type="button" onClick={() => onBulkStatus(selected, "Active")}>Activate</button>
          <button type="button" onClick={() => onBulkStatus(selected, "Inactive")}>Deactivate</button>
          <button type="button" className={`${styles["danger"]}`} onClick={() => onBulkDelete(selected)}>Delete</button>
        </SelectionBar>
      )}
      {visible.length === 0 ? (
        <EmptyState title="No users found" description="Try changing the name, status, or role filters." />
      ) : <div className={`${styles["table-card"]} ${styles["users-table"]} selection-table`}>
        <div className={`${styles["table-heading"]}`}>
          <label className={`${styles["inline-select"]}`} aria-label="Select all visible users"><input type="checkbox" checked={visible.every((user) => selected.includes(user.id))} onChange={() => setSelected(visible.every((user) => selected.includes(user.id)) ? selected.filter((id) => !visible.some((user) => user.id === id)) : [...new Set([...selected, ...visible.map((user) => user.id)])])} /></label>
          <span>User</span><span>Role</span><span>Status</span><span>Actions</span>
        </div>
        {visible.map((user) => (
          <div className={`${styles["table-row"]}`} key={user.id}>
            <label className={`${styles["inline-select"]}`} aria-label={`Select ${user.name}`}><input type="checkbox" checked={selected.includes(user.id)} onChange={() => setSelected((current) => current.includes(user.id) ? current.filter((id) => id !== user.id) : [...current, user.id])} /></label>
            <div className={`${styles["person"]}`}><span className={`${styles["avatar"]}`}>{user.initials}</span><div><strong>{user.name}</strong><small>{user.email}</small></div></div>
            <span className={`${styles["role"]}`}>{user.role}</span>
            <span><i className={`${styles["status-dot"]} ${styles[user.status.toLowerCase()]}`} />{user.status}</span>
            <div className={`${styles["row-actions"]}`}><button aria-label={`Edit ${user.name}`} onClick={() => onEdit(user)}><Icon name="edit" size={17} /></button><button aria-label={`Delete ${user.name}`} onClick={() => onDelete(user.id)}><Icon name="trash" size={17} /></button></div>
          </div>
        ))}
      </div>}
    </>
  )
}

function OrdersView({ onNotify }: { onNotify: (message: string) => void }) {
  const [orderList, setOrderList] = useState(starterOrders)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("All orders")
  const [dateFrom, setDateFrom] = useState("")
  const [dateUntil, setDateUntil] = useState("")
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [refundMode, setRefundMode] = useState<"full" | "partial" | "custom" | null>(null)
  const [refundQuantities, setRefundQuantities] = useState<Record<string, number>>({})
  const [customRefundAmount, setCustomRefundAmount] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [confirmingRefund, setConfirmingRefund] = useState(false)
  const [confirmingCancellation, setConfirmingCancellation] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const selectedOrder = orderList.find((order) => order.id === selectedOrderId) ?? null
  const visible = useMemo(() => orderList.filter((order) => {
    const orderDate = getOrderDate(order.date)
    const orderDateKey = [
      orderDate.getFullYear(),
      String(orderDate.getMonth() + 1).padStart(2, "0"),
      String(orderDate.getDate()).padStart(2, "0"),
    ].join("-")
    const matchesDate = (!dateFrom || orderDateKey >= dateFrom) && (!dateUntil || orderDateKey <= dateUntil)
    const matchesStatus =
      status === "All orders" ||
      (status === "Refunded orders" ? order.refundedAmount > 0 : order.status === status)
    return matchesStatus &&
      matchesDate &&
      `${order.id} ${order.customer}`.toLowerCase().includes(query.toLowerCase())
  }), [dateFrom, dateUntil, orderList, query, status])
  const partialRefundAmount = selectedOrder?.lineItems.reduce((total, item) => total + (Number(item.price.replace("$", "")) / item.quantity) * (refundQuantities[item.name] ?? 0), 0) ?? 0
  const refundableBalance = selectedOrder ? Math.max(0, Number(selectedOrder.total.replace("$", "")) - selectedOrder.refundedAmount) : 0
  const refundAmount = refundMode === "full" ? refundableBalance : refundMode === "custom" ? Number(customRefundAmount) || 0 : partialRefundAmount
  useEffect(() => setSelected((current) => current.filter((id) => orderList.some((order) => order.id === id))), [orderList])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])
  const openOrder = (id: string) => {
    setSelectedOrderId(id)
    setRefundMode(null)
    setRefundQuantities({})
    setCustomRefundAmount("")
  }
  const closeOrder = () => {
    setSelectedOrderId(null)
    setRefundMode(null)
    setRefundQuantities({})
    setCustomRefundAmount("")
  }
  const exportOrders = (orders: typeof orderList) => {
    const spreadsheetCell = (value: string) => {
      const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value
      return `"${safeValue.replaceAll('"', '""')}"`
    }
    const rows = [
      ["Order", "Table", "Customer", "Date", "Total", "Status", "Refund status"],
      ...orders.map((order) => [order.id, order.table, order.customer, order.date, order.total, order.status, getRefundStatus(order) ?? ""]),
    ]
    const csv = rows.map((row) => row.map((cell) => spreadsheetCell(String(cell))).join(",")).join("\n")
    const downloadUrl = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = downloadUrl
    link.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(downloadUrl)
    onNotify(`${orders.length} ${orders.length === 1 ? "order" : "orders"} exported`)
  }
  const confirmRefund = () => {
    if (!selectedOrder) return
    const fullTotal = Number(selectedOrder.total.replace("$", ""))
    const amount = refundAmount
    if (amount <= 0) return
    const totalRefunded = Math.min(fullTotal, selectedOrder.refundedAmount + amount)
    setOrderList((current) => current.map((order) => order.id === selectedOrder.id ? {
      ...order,
      refundedAmount: totalRefunded,
    } : order))
    setRefundMode(null)
    setRefundQuantities({})
    setCustomRefundAmount("")
    setConfirmingRefund(false)
    onNotify(`Refund completed for order ${selectedOrder.id}`)
  }
  const cancelOrder = () => {
    if (!selectedOrder || selectedOrder.status !== "Active") return
    setOrderList((current) => current.map((order) => order.id === selectedOrder.id ? { ...order, status: "Canceled" } : order))
    setConfirmingCancellation(false)
    onNotify(`Order ${selectedOrder.id} canceled`)
  }
  return (
    <>
      <PageHeader eyebrow="Sales archive" title="Order history" description="Review active, completed, canceled, and refunded orders from your café." />
      <div className={`${styles["stats"]}`}>
        <div><span>Today’s orders</span><strong>24</strong><small>12% from yesterday</small></div>
        <div><span>Today’s revenue</span><strong>$286.40</strong><small>8% from yesterday</small></div>
        <div><span>Average order</span><strong>$11.93</strong><small>Across all orders</small></div>
      </div>
      <div className={`${styles["toolbar"]} ${styles["orders-toolbar"]}`}>
        <label className={`${styles["search-box"]}`}><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search orders" /></label>
        <div className={`${styles["order-filters"]}`}>
          <div className={`${styles["filter-group"]}`}>
            <span className={`${styles["filter-group-label"]}`}>Order status</span>
            <div className={`${styles["filter-pills"]}`}>
              {["All orders", "Active", "Completed", "Canceled"].map((item) => <button key={item} className={status === item ? styles["active"] : ""} onClick={() => setStatus(item)}>{item}</button>)}
            </div>
          </div>
          <div className={`${styles["filter-group"]}`}>
            <span className={`${styles["filter-group-label"]}`}>Refunds</span>
            <div className={`${styles["filter-pills"]}`}>
              <button className={status === "Refunded orders" ? styles["active"] : ""} onClick={() => setStatus("Refunded orders")}>Refunded</button>
            </div>
          </div>
          <div className={`${styles["filter-group"]}`}>
            <span className={`${styles["filter-group-label"]}`}>Date</span>
            <div className={`${styles["date-range"]}`}>
              <label className={`${styles["filter-select"]}`}>
                <span>From</span>
                <input type="date" value={dateFrom} max={dateUntil || undefined} onChange={(event) => setDateFrom(event.target.value)} />
              </label>
              <label className={`${styles["filter-select"]}`}>
                <span>Until</span>
                <input type="date" value={dateUntil} min={dateFrom || undefined} onChange={(event) => setDateUntil(event.target.value)} />
              </label>
            </div>
          </div>
          <button
            className={`${styles["reset-filters"]}`}
            type="button"
            disabled={!query && status === "All orders" && !dateFrom && !dateUntil}
            onClick={() => {
              setQuery("")
              setStatus("All orders")
              setDateFrom("")
              setDateUntil("")
            }}
          >
            Reset filters
          </button>
          <button className={`${styles["export-table"]}`} type="button" disabled={visible.length === 0} onClick={() => exportOrders(visible)}>
            <Icon name="download" size={15} />
            Export table
          </button>
        </div>
      </div>
      {selected.length > 0 && (
        <SelectionBar count={selected.length} onClear={() => setSelected([])}>
          <button type="button" onClick={() => exportOrders(orderList.filter((order) => selected.includes(order.id)))}><Icon name="download" size={14} />Export selected</button>
        </SelectionBar>
      )}
      {visible.length === 0 ? (
        <EmptyState title="No orders found" description="Try changing your search, status, or date filters." />
      ) : <div className={`${styles["table-card"]} ${styles["order-table"]} selection-table`}>
        <div className={`${styles["table-heading"]}`}>
          <label className={`${styles["inline-select"]}`} aria-label="Select all visible orders"><input type="checkbox" checked={visible.every((order) => selected.includes(order.id))} onChange={() => setSelected(visible.every((order) => selected.includes(order.id)) ? selected.filter((id) => !visible.some((order) => order.id === id)) : [...new Set([...selected, ...visible.map((order) => order.id)])])} /></label>
          <span>Order</span><span>Customer</span><span>Date</span><span>Total</span><span>Status</span>
        </div>
        {visible.map((order) => (
          <div
            className={`${styles["table-row"]} ${styles["clickable-order"]}`}
            key={order.id}
            role="button"
            tabIndex={0}
            onClick={() => openOrder(order.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") openOrder(order.id)
            }}
          >
            <label className={`${styles["inline-select"]}`} aria-label={`Select order ${order.id}`} onClick={(event) => event.stopPropagation()}>
              <input type="checkbox" checked={selected.includes(order.id)} onChange={() => setSelected((current) => current.includes(order.id) ? current.filter((id) => id !== order.id) : [...current, order.id])} />
            </label>
            <strong>{order.id}</strong>
            <div><strong>{order.customer}</strong><small>{order.items} · Table {order.table}</small></div>
            <div><span>{order.date}</span>{order.status === "Active" && <small className={`${styles["running-time"]}`}>Running {formatRunningTime(order.date, now)}</small>}</div>
            <strong>{order.total}</strong>
            <div className={`${styles["order-statuses"]}`}>
              <span className={`${styles["order-status"]} ${styles[order.status.toLowerCase()]}`}>{order.status}</span>
              {getRefundStatus(order) && <span className={`${styles["order-status"]} ${styles["refund-badge"]} ${getRefundStatus(order) === "Refunded" ? styles["refunded"] : styles["partially"]}`}>{getRefundStatus(order)}</span>}
            </div>
          </div>
        ))}
      </div>}
      {selectedOrder && (
        <div className={`${styles["modal-backdrop"]} ${styles["order-backdrop"]}`} onMouseDown={closeOrder}>
          <section className={`${styles["order-detail"]}`} onMouseDown={(event) => event.stopPropagation()} aria-label={`Order ${selectedOrder.id} details`}>
            <button className={`${styles["modal-close"]}`} onClick={closeOrder} aria-label="Close order details"><Icon name="close" /></button>
            <p className={`${styles["modal-kicker"]}`}>Order details</p>
            <div className={`${styles["order-detail-title"]}`}>
              <div><h2>{selectedOrder.id}</h2><p>{selectedOrder.date} · Table {selectedOrder.table}{selectedOrder.status === "Active" && <strong className={`${styles["running-time"]}`}>Running {formatRunningTime(selectedOrder.date, now)}</strong>}</p></div>
              <span className={`${styles["order-status"]} ${styles[selectedOrder.status.toLowerCase()]}`}>{selectedOrder.status}</span>
            </div>
            <div className={`${styles["order-customer"]}`}>
              <span>{selectedOrder.customer.split(" ").map((part) => part[0]).join("")}</span>
              <div><small>Customer</small><strong>{selectedOrder.customer}</strong></div>
            </div>
            <h3>Items in this order</h3>
            <div className={`${styles["order-lines"]}`}>
              {selectedOrder.lineItems.map((item) => (
                <div className={`${styles["order-line"]}`} key={item.name}>
                  <img src={item.image} alt="" />
                  <div><strong>{item.name}</strong><small>Quantity {item.quantity}</small></div>
                  {refundMode === "partial" ? (
                    <div className={`${styles["refund-quantity"]}`}>
                      <button type="button" aria-label={`Remove one ${item.name} from refund`} onClick={() => setRefundQuantities({ ...refundQuantities, [item.name]: Math.max(0, (refundQuantities[item.name] ?? 0) - 1) })}>−</button>
                      <strong>{refundQuantities[item.name] ?? 0}</strong>
                      <button type="button" aria-label={`Add one ${item.name} to refund`} onClick={() => setRefundQuantities({ ...refundQuantities, [item.name]: Math.min(item.quantity, (refundQuantities[item.name] ?? 0) + 1) })}>+</button>
                    </div>
                  ) : <strong>{item.price}</strong>}
                </div>
              ))}
            </div>
            <div className={`${styles["order-summary"]}`}>
              <div><span>Subtotal</span><strong>{selectedOrder.total}</strong></div>
              <div><span>Tax</span><strong>Included</strong></div>
              <div className={`${styles["order-total"]}`}><span>Total</span><strong>{selectedOrder.total}</strong></div>
            </div>
            <div className={`${styles["payment-line"]}`}><span>Payment method</span><strong>{selectedOrder.payment}</strong></div>
            {selectedOrder.refundedAmount > 0 && (
              <div className={`${styles["refunded-line"]}`}><span>Refunded to date</span><strong>−${selectedOrder.refundedAmount.toFixed(2)}</strong></div>
            )}
            {selectedOrder.status === "Active" && (
              <button type="button" className={`${styles["cancel-order"]}`} onClick={() => setConfirmingCancellation(true)}>Cancel order</button>
            )}
            {selectedOrder.status !== "Canceled" && refundableBalance > 0 && !refundMode && (
              <div className={`${styles["refund-actions"]}`}>
                <button type="button" className={`${styles["secondary-button"]}`} onClick={() => setRefundMode("partial")}>Partial refund</button>
                <button type="button" className={`${styles["secondary-button"]}`} onClick={() => setRefundMode("custom")}>Other amount</button>
                <button type="button" className={`${styles["refund-button"]}`} onClick={() => setRefundMode("full")}>Refund full order</button>
              </div>
            )}
            {refundMode && (
              <div className={`${styles["refund-confirmation"]}`}>
                <div>
                  <span>{refundMode === "full" ? "Remaining balance" : refundMode === "custom" ? "Custom refund" : "Selected refund"}</span>
                  <strong>${refundAmount.toFixed(2)}</strong>
                </div>
                {refundMode === "custom" ? (
                  <label className={`${styles["custom-refund"]}`}>
                    Refund amount
                    <span><strong>$</strong><input autoFocus type="number" min="0.01" max={refundableBalance} step="0.01" value={customRefundAmount} onChange={(event) => setCustomRefundAmount(event.target.value)} /></span>
                    <small>Up to ${refundableBalance.toFixed(2)} can be refunded.</small>
                  </label>
                ) : <p>{refundMode === "full" ? `The remaining balance will be returned to ${selectedOrder.payment}.` : "Choose the quantity to refund beside each item."}</p>}
                <div>
                  <button type="button" className={`${styles["secondary-button"]}`} onClick={() => { setRefundMode(null); setRefundQuantities({}); setCustomRefundAmount("") }}>Cancel</button>
                  <button type="button" className={`${styles["refund-button"]}`} disabled={refundAmount <= 0 || refundAmount > refundableBalance} onClick={() => setConfirmingRefund(true)}>Confirm refund</button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
      {confirmingRefund && selectedOrder && (
        <ConfirmDialog
          confirmation={{
            title: `Refund order ${selectedOrder.id}?`,
            description: `$${refundAmount.toFixed(2)} for Table ${selectedOrder.table} will be returned to ${selectedOrder.payment}. This action cannot be undone.`,
            actionLabel: "Issue refund",
            onConfirm: confirmRefund,
          }}
          onClose={() => setConfirmingRefund(false)}
        />
      )}
      {confirmingCancellation && selectedOrder && (
        <ConfirmDialog
          confirmation={{
            title: `Cancel order ${selectedOrder.id}?`,
            description: `The order for Table ${selectedOrder.table} will be marked as canceled and removed from the active queue. This action cannot be undone.`,
            actionLabel: "Cancel order",
            onConfirm: cancelOrder,
          }}
          onClose={() => setConfirmingCancellation(false)}
        />
      )}
    </>
  )
}

function PageHeader({ eyebrow, title, description, action, onAction }: { eyebrow: string; title: string; description: string; action?: string; onAction?: () => void }) {
  return <header className={`${styles["page-header"]}`}><div><p>{eyebrow}</p><h1>{title}</h1><span>{description}</span></div>{action && <button className={`${styles["primary-button"]}`} onClick={onAction}><Icon name="plus" size={17} />{action}</button>}</header>
}

function ItemModal({ item, sections, onClose, onSave }: { item: MenuItem | null; sections: string[]; onClose: () => void; onSave: (item: MenuItem) => void }) {
  const [form, setForm] = useState<MenuItem>(() => item ?? { id: Date.now(), name: "", category: sections[0] ?? "", description: "", price: 0, image: "/menu/matcha.jpg", available: true })
  const submit = (event: FormEvent) => { event.preventDefault(); onSave(form) }
  return (
    <div className={`${styles["modal-backdrop"]}`} onMouseDown={onClose}>
      <form className={`${styles["modal"]}`} onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className={`${styles["modal-close"]}`} onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        <p className={`${styles["modal-kicker"]}`}>Catalog</p><h2>{item ? "Edit menu item" : "Add menu item"}</h2><p className={`${styles["modal-description"]}`}>Keep the details concise and helpful for your guests.</p>
        <div className={`${styles["form-grid"]}`}>
          <label className={`${styles["wide"]}`}>
            Item image
            <span className="mt-2.5 grid grid-cols-[112px_1fr] gap-4 rounded-[10px] border border-line bg-white p-3.5 max-[480px]:grid-cols-1">
              <img className="h-24 w-28 rounded-lg bg-[#eee8df] object-cover max-[480px]:h-36 max-[480px]:w-full" src={form.image} alt="Menu item preview" />
              <span className="flex min-w-0 flex-col items-start justify-center">
                <span className="mb-1 block text-[12px] font-bold text-[#5b5661]">{item ? "Replace image" : "Upload an image"}</span>
                <span className="mb-3 block text-[10px] leading-[1.5] font-normal text-muted">
                  Use a landscape image in a 3:2 ratio, ideally 1200 × 800 px. JPG, PNG, or WebP up to 5 MB. Keep the food centered so it crops well on menu cards.
                </span>
                <span className="inline-flex min-h-9 cursor-pointer items-center justify-center rounded-lg border border-[#d9d3ca] bg-[#f9f6ef] px-3 text-[11px] font-bold text-[#625e68] transition-colors hover:border-berry hover:text-berry">
                  Choose image
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (!file) return
                      if (file.size > 5 * 1024 * 1024) {
                        window.alert("Please choose an image smaller than 5 MB.")
                        event.target.value = ""
                        return
                      }
                      const reader = new FileReader()
                      reader.onload = () => {
                        if (typeof reader.result === "string") setForm({ ...form, image: reader.result })
                      }
                      reader.readAsDataURL(file)
                    }}
                  />
                </span>
              </span>
            </span>
          </label>
          <label className={`${styles["wide"]}`}>Item name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Iced matcha" /></label>
          <label>Section<select required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{sections.map((section) => <option key={section}>{section}</option>)}</select></label>
          <label>Price ($)<input required min="0" step="0.1" type="number" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} /></label>
          <label className={`${styles["wide"]}`}>Description<textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="A short description of the item" /></label>
          <label className={`${styles["switch-row"]} ${styles["wide"]}`}><span><strong>Available to order</strong><small>Show this item on the customer menu</small></span><input type="checkbox" checked={form.available} onChange={(event) => setForm({ ...form, available: event.target.checked })} /></label>
        </div>
        <div className={`${styles["modal-actions"]}`}><button type="button" className={`${styles["secondary-button"]}`} onClick={onClose}>Cancel</button><button className={`${styles["primary-button"]}`} type="submit">{item ? "Save changes" : "Add item"}</button></div>
      </form>
    </div>
  )
}

function SectionsModal({
  sections,
  onClose,
  onSave,
}: {
  sections: string[]
  onClose: () => void
  onSave: (sections: string[], renamed: Record<string, string>, deleted: string[]) => void
}) {
  const [rows, setRows] = useState(sections.map((name) => ({ original: name, name })))
  const [newSection, setNewSection] = useState("")
  const addSection = () => {
    const name = newSection.trim()
    if (!name || rows.some((row) => row.name.toLowerCase() === name.toLowerCase())) return
    setRows([...rows, { original: "", name }])
    setNewSection("")
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const validRows = rows.filter((row) => row.name.trim())
    const renamed = Object.fromEntries(validRows.filter((row) => row.original && row.original !== row.name.trim()).map((row) => [row.original, row.name.trim()]))
    const remainingOriginals = new Set(validRows.map((row) => row.original).filter(Boolean))
    const deleted = sections.filter((section) => !remainingOriginals.has(section))
    onSave(validRows.map((row) => row.name.trim()), renamed, deleted)
  }
  return (
    <div className={`${styles["modal-backdrop"]}`} onMouseDown={onClose}>
      <form className={`${styles["modal"]} ${styles["small-modal"]}`} onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className={`${styles["modal-close"]}`} onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        <p className={`${styles["modal-kicker"]}`}>Catalog structure</p>
        <h2>Manage sections</h2>
        <p className={`${styles["modal-description"]}`}>Create sections and rename existing ones. Changes are reflected across the catalog.</p>
        <div className={`${styles["section-editor"]}`}>
          <p>Current sections</p>
          {rows.map((row, index) => (
            <label key={`${row.original}-${index}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <input
                required
                aria-label={`Section ${index + 1} name`}
                value={row.name}
                onChange={(event) => setRows(rows.map((entry, rowIndex) => rowIndex === index ? { ...entry, name: event.target.value } : entry))}
              />
              <button
                type="button"
                disabled={rows.length === 1}
                aria-label={`Delete ${row.name || "section"}`}
                title={rows.length === 1 ? "At least one section is required" : `Delete ${row.name}`}
                onClick={() => setRows(rows.filter((_, rowIndex) => rowIndex !== index))}
              >
                <Icon name="trash" size={15} />
              </button>
            </label>
          ))}
          <small>Deleting a section moves its menu items to the first remaining section.</small>
        </div>
        <div className={`${styles["new-section"]}`}>
          <label>
            New section
            <span>
              <input value={newSection} onChange={(event) => setNewSection(event.target.value)} placeholder="e.g. Pastries" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSection() } }} />
              <button type="button" onClick={addSection}><Icon name="plus" size={15} />Add</button>
            </span>
          </label>
        </div>
        <div className={`${styles["modal-actions"]}`}><button type="button" className={`${styles["secondary-button"]}`} onClick={onClose}>Cancel</button><button className={`${styles["primary-button"]}`} type="submit">Save sections</button></div>
      </form>
    </div>
  )
}

function TableModal({ table, tables, onClose, onSave }: { table: CafeTable | null; tables: CafeTable[]; onClose: () => void; onSave: (table: CafeTable) => void }) {
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
        <div className={`${styles["modal-actions"]}`}><button type="button" className={`${styles["secondary-button"]}`} onClick={onClose}>Cancel</button><button className={`${styles["primary-button"]}`} type="submit">{table ? "Save changes" : "Add table"}</button></div>
      </form>
    </div>
  )
}

function UserModal({ user, onClose, onSave }: { user: User | null; onClose: () => void; onSave: (user: User) => void }) {
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
        <div className={`${styles["modal-actions"]}`}><button type="button" className={`${styles["secondary-button"]}`} onClick={onClose}>Cancel</button><button className={`${styles["primary-button"]}`} type="submit">{user ? "Save changes" : "Add user"}</button></div>
      </form>
    </div>
  )
}

export default function App() {
  const [section, setSection] = useState<Section>("catalog")
  const [items, setItems] = useState(starterItems)
  const [catalogSections, setCatalogSections] = useState(["Hot Beverages", "Breakfast", "Lunch"])
  const [tables, setTables] = useState(starterTables)
  const [users, setUsers] = useState(starterUsers)
  const [itemModal, setItemModal] = useState<{ open: boolean; item: MenuItem | null }>({ open: false, item: null })
  const [tableModal, setTableModal] = useState<{ open: boolean; table: CafeTable | null }>({ open: false, table: null })
  const [userModal, setUserModal] = useState<{ open: boolean; user: User | null }>({ open: false, user: null })
  const [sectionsModal, setSectionsModal] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [toast, setToast] = useState("")
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setTables((current) => current.some((table) => table.location === "Pick-up")
      ? current
      : [...current, { id: 7, number: "Pick-up", available: true, location: "Pick-up" }])
  }, [])

  const showToast = (message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(""), 3200)
  }

  const saveItem = (item: MenuItem) => {
    setItems((current) => current.some((entry) => entry.id === item.id) ? current.map((entry) => entry.id === item.id ? item : entry) : [item, ...current])
    setItemModal({ open: false, item: null })
    showToast(`Menu item ${item.name} saved`)
  }
  const saveUser = (user: User) => {
    setUsers((current) => current.some((entry) => entry.id === user.id) ? current.map((entry) => entry.id === user.id ? user : entry) : [user, ...current])
    setUserModal({ open: false, user: null })
    showToast(`User ${user.name} saved`)
  }
  const saveTable = (table: CafeTable) => {
    const normalizedTable = table.available ? { ...table, currentOrder: undefined, seatedAt: undefined } : { ...table, currentOrder: table.currentOrder ?? "Awaiting order", seatedAt: table.seatedAt ?? "Just now" }
    setTables((current) => current.some((entry) => entry.id === table.id) ? current.map((entry) => entry.id === table.id ? normalizedTable : entry) : [...current, normalizedTable])
    setTableModal({ open: false, table: null })
    showToast(`Table ${table.number} saved`)
  }
  const navigate = (next: Section) => { setSection(next); setMobileNav(false) }

  return (
    <div className={`${styles["app-shell"]}`}>
      <button className={`${styles["mobile-menu"]}`} onClick={() => setMobileNav(!mobileNav)} aria-label="Open navigation"><span /><span /><span /></button>
      {mobileNav && <button className={`${styles["nav-scrim"]}`} onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
      <aside className={mobileNav ? styles["open"] : ""}>
        <div className={`${styles["brand"]}`}><span><Icon name="coffee" size={25} /></span><div><strong>Café Shop</strong><small>Admin workspace</small></div></div>
        <nav>
          <p>Workspace</p>
          <button className={section === "catalog" ? styles["active"] : ""} onClick={() => navigate("catalog")}><Icon name="catalog" />Catalog</button>
          <button className={section === "tables" ? styles["active"] : ""} onClick={() => navigate("tables")}><Icon name="tables" />Tables</button>
          <button className={section === "users" ? styles["active"] : ""} onClick={() => navigate("users")}><Icon name="users" />Users</button>
          <button className={section === "orders" ? styles["active"] : ""} onClick={() => navigate("orders")}><Icon name="orders" />Order history</button>
        </nav>
        <div className={`${styles["sidebar-footer"]}`}>
          <div className={`${styles["admin-profile"]}`}><span>MJ</span><div><strong>Maya Johnson</strong><small>Manager</small></div><Icon name="chevron" size={15} /></div>
          <button><Icon name="logout" />Sign out</button>
        </div>
      </aside>
      <main>
        <div className={`${styles["content"]}`}>
          {section === "catalog" && <Catalog
            items={items}
            sections={catalogSections}
            onAdd={() => setItemModal({ open: true, item: null })}
            onEdit={(item) => setItemModal({ open: true, item })}
            onDelete={(id) => {
              const item = items.find((entry) => entry.id === id)
              setConfirmation({ title: `Delete ${item?.name ?? "menu item"}?`, description: "This item will be permanently removed from the catalog.", actionLabel: "Delete item", onConfirm: () => { setItems((current) => current.filter((entry) => entry.id !== id)); showToast("Menu item deleted") } })
            }}
            onBulkAvailability={(ids, available) => { setItems((current) => current.map((item) => ids.includes(item.id) ? { ...item, available } : item)); showToast(`${ids.length} menu items updated`) }}
            onBulkDelete={(ids) => setConfirmation({ title: `Delete ${ids.length} menu items?`, description: "The selected items will be permanently removed from the catalog.", actionLabel: "Delete items", onConfirm: () => { setItems((current) => current.filter((item) => !ids.includes(item.id))); showToast(`${ids.length} menu items deleted`) } })}
            onManageSections={() => setSectionsModal(true)}
          />}
          {section === "tables" && <TablesView
            tables={tables}
            onAdd={() => setTableModal({ open: true, table: null })}
            onEdit={(table) => setTableModal({ open: true, table })}
            onDelete={(id) => {
              const table = tables.find((entry) => entry.id === id)
              setConfirmation({ title: `Delete table ${table?.number ?? ""}?`, description: "Its ordering link and QR code will no longer be managed here.", actionLabel: "Delete table", onConfirm: () => { setTables((current) => current.filter((entry) => entry.id !== id)); showToast("Table deleted") } })
            }}
            onToggleAvailability={(id) => {
              setTables((current) => current.map((table) => table.id === id ? table.available ? { ...table, available: false, currentOrder: "Awaiting order", seatedAt: "Just now" } : { ...table, available: true, currentOrder: undefined, seatedAt: undefined } : table))
              const table = tables.find((entry) => entry.id === id)
              showToast(`Table ${table?.number} marked ${table?.available ? "occupied" : "available"}`)
            }}
            onBulkAvailability={(ids, available) => {
              setTables((current) => current.map((table) => ids.includes(table.id) ? available ? { ...table, available: true, currentOrder: undefined, seatedAt: undefined } : { ...table, available: false, currentOrder: table.currentOrder ?? "Awaiting order", seatedAt: table.seatedAt ?? "Just now" } : table))
              showToast(`${ids.length} tables updated`)
            }}
            onBulkDelete={(ids) => setConfirmation({ title: `Delete ${ids.length} tables?`, description: "Their ordering links and QR codes will no longer be managed here.", actionLabel: "Delete tables", onConfirm: () => { setTables((current) => current.filter((table) => !ids.includes(table.id))); showToast(`${ids.length} tables deleted`) } })}
            onNotify={showToast}
          />}
          {section === "users" && <UsersView
            users={users}
            onAdd={() => setUserModal({ open: true, user: null })}
            onEdit={(user) => setUserModal({ open: true, user })}
            onDelete={(id) => {
              const user = users.find((entry) => entry.id === id)
              setConfirmation({ title: `Delete ${user?.name ?? "user"}?`, description: "This person will lose access to the Café Shop workspace.", actionLabel: "Delete user", onConfirm: () => { setUsers((current) => current.filter((entry) => entry.id !== id)); showToast("User deleted") } })
            }}
            onBulkStatus={(ids, status) => { setUsers((current) => current.map((user) => ids.includes(user.id) ? { ...user, status } : user)); showToast(`${ids.length} users marked ${status.toLowerCase()}`) }}
            onBulkDelete={(ids) => setConfirmation({ title: `Delete ${ids.length} users?`, description: "The selected people will lose access to the Café Shop workspace.", actionLabel: "Delete users", onConfirm: () => { setUsers((current) => current.filter((user) => !ids.includes(user.id))); showToast(`${ids.length} users deleted`) } })}
          />}
          {section === "orders" && <OrdersView onNotify={showToast} />}
        </div>
      </main>
      {itemModal.open && <ItemModal item={itemModal.item} sections={catalogSections} onClose={() => setItemModal({ open: false, item: null })} onSave={saveItem} />}
      {tableModal.open && <TableModal table={tableModal.table} tables={tables} onClose={() => setTableModal({ open: false, table: null })} onSave={saveTable} />}
      {userModal.open && <UserModal user={userModal.user} onClose={() => setUserModal({ open: false, user: null })} onSave={saveUser} />}
      {sectionsModal && <SectionsModal sections={catalogSections} onClose={() => setSectionsModal(false)} onSave={(nextSections, renamed, deleted) => {
        setCatalogSections(nextSections)
        setItems((current) => current.map((item) => {
          if (renamed[item.category]) return { ...item, category: renamed[item.category] }
          if (deleted.includes(item.category)) return { ...item, category: nextSections[0] }
          return item
        }))
        setSectionsModal(false)
        showToast("Catalog sections saved")
      }} />}
      {confirmation && <ConfirmDialog confirmation={confirmation} onClose={() => setConfirmation(null)} />}
      {toast && <div className={`${styles["toast"]}`} role="status">{toast}</div>}
    </div>
  )
}

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { buttonVariants } from "@shared/ui/Button"
import { AdminModal } from "../../components/AdminModal"
import { EmptyState, PageHeader, SelectionBar } from "../../components/AdminUi"
import { useAdminUi } from "../../hooks/AdminUiProvider"
import { useAdminWorkspace } from "../../hooks/useAdminWorkspace"
import { getTableUrl } from "./tableQr.utils"
import { TableModal } from "./TableDialog"
import type { CafeTable } from "../../types"

export function TablesPage() {
  const { notify, confirm } = useAdminUi()
  const workspace = useAdminWorkspace({ notify, confirm })
  const tables = workspace.tables
  const [location, setLocation] = useState("All tables")
  const [selected, setSelected] = useState<number[]>([])
  const [tableModal, setTableModal] = useState<{ open: boolean; table: CafeTable | null }>({
    open: false,
    table: null,
  })
  const visible = tables.filter((table) => location === "All tables" || table.location === location)
  const available = tables.filter((table) => table.available).length
  useEffect(() => setSelected((current) => current.filter((id) => tables.some((table) => table.id === id))), [tables])

  const closeTableModal = () => setTableModal({ open: false, table: null })
  const saveTable = (table: CafeTable) => {
    workspace.saveTable(table)
    closeTableModal()
  }

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
    notify("Printable QR sheet downloaded")
  }

  return (
    <>
      <PageHeader eyebrow="Seating management" title="Tables" description="Manage your café seating, location, and live availability." action="Add table" onAction={() => setTableModal({ open: true, table: null })} />
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
          <button type="button" onClick={() => workspace.bulkAvailabilityTables(selected, true)}>Mark available</button>
          <button type="button" onClick={() => workspace.bulkAvailabilityTables(selected, false)}>Mark occupied</button>
          <button type="button" className={`${styles["danger"]}`} onClick={() => workspace.bulkDeleteTables(selected)}>Delete</button>
        </SelectionBar>
      )}
      {visible.length === 0 ? (
        <EmptyState title="No tables found" description="Try another location filter or add a new table." />
      ) : <div className={`${styles["tables-grid"]}`}>
        {visible.map((table) => (
          <article className={`${styles["table-card-item"]} ${selected.includes(table.id) ? styles["selected"] : ""}`} key={table.id}>
            <div className={`${styles["table-card-top"]}`}>
              <label className={`${styles["inline-select"]}`} aria-label={`Select table ${table.number}`}><input type="checkbox" checked={selected.includes(table.id)} onChange={() => setSelected((current) => current.includes(table.id) ? current.filter((id) => id !== table.id) : [...current, table.id])} /></label>
              <button type="button" className={`${styles["table-state"]} ${table.available ? styles["available"] : styles["occupied"]}`} onClick={() => workspace.toggleTableAvailability(table.id)} title={`Mark table ${table.number} ${table.available ? "occupied" : "available"}`}><i />{table.available ? "Available" : "Occupied"}</button>
              <div className={`${styles["row-actions"]}`}>
                <button aria-label={`Edit table ${table.number}`} onClick={() => setTableModal({ open: true, table })}><Icon name="edit" size={16} /></button>
                <button aria-label={`Delete table ${table.number}`} onClick={() => workspace.deleteTable(table.id)}><Icon name="trash" size={16} /></button>
              </div>
            </div>
            <div className={`${styles["table-card-content"]}`}>
              <div className={`${styles["table-illustration"]}`}>
                <span><Icon name="tables" size={28} /></span>
                <small>Table</small>
                <strong>{table.number}</strong>
              </div>
              <TableQrCode tableNumber={table.number} onNotify={notify} />
            </div>
            {!table.available && <div className={`${styles["active-seating"]}`}><span>Current order <strong>{table.currentOrder ?? "Awaiting order"}</strong></span><span>Seated <strong>{table.seatedAt ?? "Just now"}</strong></span></div>}
            <div className={`${styles["table-location"]}`}>
              <div><span>Location</span><strong>{table.location}</strong></div>
              {table.location !== "Pick-up" && <div><span>Seats</span><strong>{table.seats ?? 2}</strong></div>}
            </div>
          </article>
        ))}
      </div>}

      {tableModal.open && (
        <TableModal
          table={tableModal.table}
          tables={tables}
          onClose={closeTableModal}
          onSave={saveTable}
        />
      )}
    </>
  )
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
      {previewOpen && (
        <AdminModal labelledBy="qr-preview-title" describedBy="qr-preview-description" onClose={() => setPreviewOpen(false)} panelClassName={styles["qr-modal"]}>
          <p className={`${styles["modal-kicker"]}`}>Table ordering</p>
          <h2 id="qr-preview-title">Table {tableNumber}</h2>
          <p className={`${styles["modal-description"]}`} id="qr-preview-description">Guests can scan this code to start an order assigned to this table.</p>
          <img src={source} alt={`Large QR code for table ${tableNumber}`} />
          <code>{getTableUrl(tableNumber)}</code>
          <div className={`${styles["modal-actions"]}`}>
            <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={async () => { await navigator.clipboard.writeText(getTableUrl(tableNumber)); onNotify("Table link copied") }}>Copy link</button>
            <button type="button" className={buttonVariants({ variant: "primary" })} onClick={downloadQrCode}><Icon name="download" size={15} />Download PNG</button>
          </div>
        </AdminModal>
      )}
    </div>
  )
}

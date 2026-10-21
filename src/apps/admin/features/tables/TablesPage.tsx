import { useEffect, useState } from "react"
import QRCode from "qrcode"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { StatusPill } from "@shared/ui/StatusPill"
import { buttonVariants } from "@shared/ui/Button"
import { AdminModal } from "../../components/AdminModal"
import { EmptyState, PageHeader, SelectionBar } from "../../components/AdminUi"
import { useRestaurant } from "@shared/restaurant/RestaurantProvider"
import { useAdminUi } from "../../hooks/AdminUiProvider"
import { useTables } from "../../hooks/useTables"
import { buildTableQrUrl } from "./tableQr.utils"
import { formatElapsed } from "./table.utils"
import { TableModal } from "./TableDialog"
import type { TableVM } from "../../types"

export function TablesPage() {
  const { restaurant } = useRestaurant()
  const { notify, confirm } = useAdminUi()
  const tables = useTables(restaurant?.id ?? "", { onSuccess: notify, onError: notify })
  const slug = restaurant?.slug ?? ""
  const restaurantName = restaurant?.name ?? "Your restaurant"

  const [location, setLocation] = useState("All tables")
  const [selected, setSelected] = useState<string[]>([])
  const [tableModal, setTableModal] = useState<{ open: boolean; table: TableVM | null }>({
    open: false,
    table: null,
  })
  const [now, setNow] = useState(() => Date.now())

  const locations = ["All tables", ...new Set(tables.tables.map((table) => table.locationLabel ?? "Unassigned"))]
  const visible = tables.tables.filter(
    (table) => location === "All tables" || (table.locationLabel ?? "Unassigned") === location,
  )
  const enabledCount = tables.tables.filter((table) => table.isActive).length
  const occupiedCount = tables.tables.filter((table) => table.openOrder).length

  useEffect(
    () => setSelected((current) => current.filter((id) => tables.tables.some((table) => table.id === id))),
    [tables.tables],
  )
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const closeTableModal = () => setTableModal({ open: false, table: null })

  const requestDelete = (table: TableVM) => {
    confirm({
      title: `Delete table ${table.number}?`,
      description: "Its ordering link and QR code will no longer work. Past orders keep their table reference.",
      actionLabel: "Delete table",
      onConfirm: () => {
        void tables.deleteTable(table.id).then((ok) => {
          if (ok) setSelected((current) => current.filter((id) => id !== table.id))
        })
      },
    })
  }

  const requestBulkDelete = () => {
    confirm({
      title: `Delete ${selected.length} tables?`,
      description: "Their ordering links and QR codes will stop working immediately.",
      actionLabel: "Delete tables",
      onConfirm: () => {
        void tables.deleteTables(selected).then((ok) => {
          if (ok) setSelected([])
        })
      },
    })
  }

  const downloadQrSheet = async () => {
    const cards = await Promise.all(tables.tables.map(async (table) => {
      const source = await QRCode.toDataURL(buildTableQrUrl({ slug, qrToken: table.qrToken }), { width: 360, margin: 2 })
      return `<article><img src="${source}" alt=""><h2>Table ${table.number}</h2><p>${table.locationLabel ?? ""}</p></article>`
    }))
    const sheet = `<!doctype html><html><head><meta charset="utf-8"><title>${restaurantName} table QR codes</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#37333a}header{text-align:center;margin-bottom:28px}main{display:grid;grid-template-columns:repeat(2,1fr);gap:24px}article{break-inside:avoid;text-align:center;border:1px solid #ddd;border-radius:16px;padding:24px}img{width:220px;height:220px}h2{margin:12px 0 4px}p{margin:0;color:#777}@media print{body{margin:12mm}article{border-color:#bbb}}</style></head><body><header><h1>${restaurantName}</h1><p>Scan to order</p></header><main>${cards.join("")}</main></body></html>`
    const downloadUrl = URL.createObjectURL(new Blob([sheet], { type: "text/html;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = downloadUrl
    link.download = `${slug || "restaurant"}-table-qr-codes.html`
    link.click()
    URL.revokeObjectURL(downloadUrl)
    notify("Printable QR sheet downloaded")
  }

  return (
    <>
      <PageHeader eyebrow="Seating management" title="Tables" description="Manage seating, enable or disable tables, and print QR codes." action="Add table" onAction={() => setTableModal({ open: true, table: null })} />

      {tables.error ? (
        <>
          <EmptyState title="We couldn't load your tables" description={tables.error.message} />
          <div className="flex justify-center">
            <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={tables.refetch}>Try again</button>
          </div>
        </>
      ) : tables.isLoading ? (
        <div className="py-16 text-center text-sm text-muted-2" role="status">Loading tables…</div>
      ) : (
        <>
          <div className={`${styles["table-overview"]}`}>
            <div><span>Total tables</span><strong>{tables.tables.length}</strong></div>
            <div><span>Enabled</span><strong>{enabledCount}</strong></div>
            <div><span>Occupied now</span><strong>{occupiedCount}</strong></div>
          </div>
          <div className={`${styles["toolbar"]} table-toolbar`}>
            <div className={`${styles["filter-pills"]}`}>
              {locations.map((item) => <button key={item} className={location === item ? styles["active"] : ""} onClick={() => setLocation(item)}>{item}</button>)}
            </div>
            <div className={`${styles["table-toolbar-actions"]}`}>
              <span>{visible.length} {visible.length === 1 ? "table" : "tables"}</span>
              <button type="button" className={`${styles["manage-sections"]}`} disabled={tables.tables.length === 0} onClick={() => void downloadQrSheet()}><Icon name="download" size={14} />Download QR sheet</button>
            </div>
          </div>
          {selected.length > 0 && (
            <SelectionBar count={selected.length} onClear={() => setSelected([])}>
              <button type="button" onClick={() => void tables.setActive(selected, true)}>Enable</button>
              <button type="button" onClick={() => void tables.setActive(selected, false)}>Disable</button>
              <button type="button" className={`${styles["danger"]}`} onClick={requestBulkDelete}>Delete</button>
            </SelectionBar>
          )}
          {visible.length === 0 ? (
            <EmptyState title="No tables found" description="Try another location filter or add a new table." />
          ) : <div className={`${styles["tables-grid"]}`}>
            {visible.map((table) => (
              <article className={`${styles["table-card-item"]} ${selected.includes(table.id) ? styles["selected"] : ""}`} key={table.id}>
                <div className={`${styles["table-card-top"]}`}>
                  <label className={`${styles["inline-select"]}`} aria-label={`Select table ${table.number}`}><input type="checkbox" checked={selected.includes(table.id)} onChange={() => setSelected((current) => current.includes(table.id) ? current.filter((id) => id !== table.id) : [...current, table.id])} /></label>
                  <button
                    type="button"
                    className={`${styles["table-state"]} ${table.isActive ? styles["available"] : styles["occupied"]}`}
                    onClick={() => void tables.setActive([table.id], !table.isActive)}
                    title={table.isActive ? `Disable table ${table.number}` : `Enable table ${table.number}`}
                  >
                    <i />{table.isActive ? "Enabled" : "Disabled"}
                  </button>
                  <div className={`${styles["row-actions"]}`}>
                    <button aria-label={`Edit table ${table.number}`} onClick={() => setTableModal({ open: true, table })}><Icon name="edit" size={16} /></button>
                    <button aria-label={`Delete table ${table.number}`} onClick={() => requestDelete(table)}><Icon name="trash" size={16} /></button>
                  </div>
                </div>
                <div className={`${styles["table-card-content"]}`}>
                  <div className={`${styles["table-illustration"]}`}>
                    <span><Icon name="tables" size={28} /></span>
                    <small>Table</small>
                    <strong>{table.number}</strong>
                  </div>
                  <TableQrCode tableNumber={table.number} slug={slug} qrToken={table.qrToken} onNotify={notify} />
                </div>
                {table.openOrder ? (
                  <div className={`${styles["active-seating"]}`}>
                    <span><StatusPill tone="warning" withDot={false}>Occupied</StatusPill></span>
                    <span>Order <strong>#{table.openOrder.orderNumber}</strong></span>
                    <span>Seated <strong>{formatElapsed(table.openOrder.startedAt, now)}</strong></span>
                  </div>
                ) : (
                  <div className={`${styles["active-seating"]}`}>
                    <span><StatusPill tone="success" withDot={false}>Free</StatusPill></span>
                    <span>No open order</span>
                  </div>
                )}
                <div className={`${styles["table-location"]}`}>
                  <div><span>Location</span><strong>{table.locationLabel ?? "Unassigned"}</strong></div>
                  <div><span>Seats</span><strong>{table.seats ?? "—"}</strong></div>
                </div>
              </article>
            ))}
          </div>}
        </>
      )}

      {tableModal.open && (
        <TableModal
          table={tableModal.table}
          onClose={closeTableModal}
          onCreate={tables.createTable}
          onUpdate={tables.updateTable}
        />
      )}
    </>
  )
}

function TableQrCode({ tableNumber, slug, qrToken, onNotify }: { tableNumber: string; slug: string; qrToken: string; onNotify: (message: string) => void }) {
  const [source, setSource] = useState("")
  const [previewOpen, setPreviewOpen] = useState(false)
  const url = buildTableQrUrl({ slug, qrToken })

  useEffect(() => {
    let active = true
    QRCode.toDataURL(buildTableQrUrl({ slug, qrToken }), {
      width: 180,
      margin: 1,
      color: { dark: "#37333A", light: "#FFFFFF" },
    }).then((dataUrl) => {
      if (active) setSource(dataUrl)
    })
    return () => {
      active = false
    }
  }, [qrToken, slug])

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
          <code>{url}</code>
          <div className={`${styles["modal-actions"]}`}>
            <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={async () => { await navigator.clipboard.writeText(url); onNotify("Table link copied") }}>Copy link</button>
            <button type="button" className={buttonVariants({ variant: "primary" })} onClick={downloadQrCode}><Icon name="download" size={15} />Download PNG</button>
          </div>
        </AdminModal>
      )}
    </div>
  )
}

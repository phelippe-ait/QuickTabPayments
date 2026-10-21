import { type FormEvent, useState } from "react"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { buttonVariants } from "@shared/ui/Button"
import { AdminModal } from "../../components/AdminModal"
import type { MenuItem } from "../../types"

export function ItemModal({ item, sections, onClose, onSave }: { item: MenuItem | null; sections: string[]; onClose: () => void; onSave: (item: MenuItem) => void }) {
  const [form, setForm] = useState<MenuItem>(() => item ?? { id: Date.now(), name: "", category: sections[0] ?? "", description: "", price: 0, image: "/menu/matcha.jpg", available: true })
  const submit = (event: FormEvent) => { event.preventDefault(); onSave(form) }
  return (
    <AdminModal labelledBy="item-modal-title" describedBy="item-modal-description" onClose={onClose}>
      <form onSubmit={submit}>
        <p className={`${styles["modal-kicker"]}`}>Catalog</p><h2 id="item-modal-title">{item ? "Edit menu item" : "Add menu item"}</h2><p className={`${styles["modal-description"]}`} id="item-modal-description">Keep the details concise and helpful for your guests.</p>
        <div className={`${styles["form-grid"]}`}>
          <label className={`${styles["wide"]}`}>
            Item image
            <span className="mt-2.5 grid grid-cols-[112px_1fr] gap-4 rounded-[10px] border border-line bg-white p-3.5 max-[480px]:grid-cols-1">
              <img className="h-24 w-28 rounded-lg bg-sand object-cover max-[480px]:h-36 max-[480px]:w-full" src={form.image} alt="Menu item preview" />
              <span className="flex min-w-0 flex-col items-start justify-center">
                <span className="mb-1 block text-[12px] font-bold text-ink-soft">{item ? "Replace image" : "Upload an image"}</span>
                <span className="mb-3 block text-[10px] leading-[1.5] font-normal text-muted">
                  Use a landscape image in a 3:2 ratio, ideally 1200 × 800 px. JPG, PNG, or WebP up to 5 MB. Keep the food centered so it crops well on menu cards.
                </span>
                <span className="inline-flex min-h-9 cursor-pointer items-center justify-center rounded-lg border border-line bg-cream-3 px-3 text-[11px] font-bold text-ink-mid transition-colors hover:border-berry hover:text-berry">
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
        <div className={`${styles["modal-actions"]}`}><button type="button" className={buttonVariants({ variant: "secondary" })} onClick={onClose}>Cancel</button><button className={buttonVariants({ variant: "primary" })} type="submit">{item ? "Save changes" : "Add item"}</button></div>
      </form>
    </AdminModal>
  )
}
export function SectionsModal({
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
    <AdminModal labelledBy="sections-modal-title" describedBy="sections-modal-description" onClose={onClose} panelClassName={styles["small-modal"]}>
      <form onSubmit={submit}>
        <p className={`${styles["modal-kicker"]}`}>Catalog structure</p>
        <h2 id="sections-modal-title">Manage sections</h2>
        <p className={`${styles["modal-description"]}`} id="sections-modal-description">Create sections and rename existing ones. Changes are reflected across the catalog.</p>
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
        <div className={`${styles["modal-actions"]}`}><button type="button" className={buttonVariants({ variant: "secondary" })} onClick={onClose}>Cancel</button><button className={buttonVariants({ variant: "primary" })} type="submit">Save sections</button></div>
      </form>
    </AdminModal>
  )
}

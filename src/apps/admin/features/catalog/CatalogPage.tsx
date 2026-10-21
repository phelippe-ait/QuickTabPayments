import { useEffect, useState } from "react"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { StatusPill } from "@shared/ui/StatusPill"
import { EmptyState, PageHeader, SelectionBar } from "../../components/AdminUi"
import { useAdminUi } from "../../hooks/AdminUiProvider"
import { useAdminWorkspace } from "../../hooks/useAdminWorkspace"
import type { MenuItem } from "../../types"
import { ItemModal, SectionsModal } from "./CatalogDialogs"

export function CatalogPage() {
  const { notify, confirm } = useAdminUi()
  const workspace = useAdminWorkspace({ notify, confirm })
  const items = workspace.items
  const sections = workspace.catalogSections
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("All items")
  const [selected, setSelected] = useState<number[]>([])
  const [itemModal, setItemModal] = useState<{ open: boolean; item: MenuItem | null }>({
    open: false,
    item: null,
  })
  const [sectionsModalOpen, setSectionsModalOpen] = useState(false)
  const categories = ["All items", ...sections]
  const visible = items.filter(
    (item) =>
      (category === "All items" || item.category === category) &&
      item.name.toLowerCase().includes(query.toLowerCase()),
  )
  useEffect(() => setSelected((current) => current.filter((id) => items.some((item) => item.id === id))), [items])

  const closeItemModal = () => setItemModal({ open: false, item: null })
  const saveItem = (item: MenuItem) => {
    workspace.saveItem(item)
    closeItemModal()
  }

  return (
    <>
      <PageHeader eyebrow="Menu management" title="Catalog" description="Add, update, and organize the items your guests can order." action="Add menu item" onAction={() => setItemModal({ open: true, item: null })} />
      <div className={`${styles["toolbar"]}`}>
        <label className={`${styles["search-box"]}`}><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search menu items" /></label>
        <div className={`${styles["section-tools"]}`}>
          <div className={`${styles["filter-pills"]}`}>
            {categories.map((item) => <button key={item} className={category === item ? styles["active"] : ""} onClick={() => setCategory(item)}>{item}</button>)}
          </div>
          <button className={`${styles["manage-sections"]}`} onClick={() => setSectionsModalOpen(true)}><Icon name="edit" size={14} />Manage sections</button>
        </div>
      </div>
      {selected.length > 0 && (
        <SelectionBar count={selected.length} onClear={() => setSelected([])}>
          <button type="button" onClick={() => workspace.bulkAvailabilityItems(selected, true)}>Mark available</button>
          <button type="button" onClick={() => workspace.bulkAvailabilityItems(selected, false)}>Mark unavailable</button>
          <button type="button" className={`${styles["danger"]}`} onClick={() => workspace.bulkDeleteItems(selected)}>Delete</button>
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
              <StatusPill tone={item.available ? "success" : "neutral"} withDot={false} className="absolute left-[45px] top-3">{item.available ? "Available" : "Unavailable"}</StatusPill>
              <div className={`${styles["card-actions"]}`}>
                <button aria-label={`Edit ${item.name}`} onClick={() => setItemModal({ open: true, item })}><Icon name="edit" size={16} /></button>
                <button className={`${styles["danger"]}`} aria-label={`Delete ${item.name}`} onClick={() => workspace.deleteItem(item.id)}><Icon name="trash" size={16} /></button>
              </div>
            </div>
            <div className={`${styles["menu-copy"]}`}>
              <p className={`${styles["category-label"]}`}>{item.category}</p>
              <div className={`${styles["name-price"]}`}><h3>{item.name}</h3><strong>${item.price.toFixed(2)}</strong></div>
              <p>{item.description}</p>
            </div>
          </article>
        ))}
        <button className={`${styles["add-card"]}`} onClick={() => setItemModal({ open: true, item: null })}><span><Icon name="plus" size={22} /></span><strong>Add a new item</strong><small>Expand your café menu</small></button>
      </div>}

      {itemModal.open && (
        <ItemModal
          item={itemModal.item}
          sections={sections}
          onClose={closeItemModal}
          onSave={saveItem}
        />
      )}
      {sectionsModalOpen && (
        <SectionsModal
          sections={sections}
          onClose={() => setSectionsModalOpen(false)}
          onSave={(nextSections, renamed, deleted) => {
            workspace.saveCatalogSections(nextSections, renamed, deleted)
            setSectionsModalOpen(false)
          }}
        />
      )}
    </>
  )
}

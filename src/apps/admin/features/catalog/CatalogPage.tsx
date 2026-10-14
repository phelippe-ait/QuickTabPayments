import { useEffect, useState } from "react"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { StatusPill } from "@shared/ui/StatusPill"
import { EmptyState, PageHeader, SelectionBar } from "../../components/AdminUi"
import type { MenuItem } from "../../types"

export function CatalogPage({
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
              <StatusPill tone={item.available ? "success" : "neutral"} withDot={false} className="absolute left-[45px] top-3">{item.available ? "Available" : "Unavailable"}</StatusPill>
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

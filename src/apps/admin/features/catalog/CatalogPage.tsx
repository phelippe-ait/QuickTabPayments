import { useEffect, useState } from "react"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { StatusPill } from "@shared/ui/StatusPill"
import { buttonVariants } from "@shared/ui/Button"
import { EmptyState, PageHeader, SelectionBar } from "../../components/AdminUi"
import { useRestaurant } from "@shared/restaurant/useRestaurant"
import { formatMoney } from "@shared/lib/money"
import { useAdminUi } from "../../hooks/AdminUiProvider"
import { useMenu } from "../../hooks/useMenu"
import type { MenuItemVM } from "../../viewModels"
import { ItemModal, SectionsModal } from "./CatalogDialogs"

const ALL_ITEMS = "all"

export function CatalogPage() {
  const { restaurant } = useRestaurant()
  const { notify, confirm } = useAdminUi()
  const menu = useMenu(restaurant?.id ?? "", { onSuccess: notify, onError: notify })
  const currency = restaurant?.currency ?? "AUD"

  const [query, setQuery] = useState("")
  const [categoryId, setCategoryId] = useState(ALL_ITEMS)
  const [selected, setSelected] = useState<string[]>([])
  const [itemModal, setItemModal] = useState<{ open: boolean; item: MenuItemVM | null }>({
    open: false,
    item: null,
  })
  const [sectionsModalOpen, setSectionsModalOpen] = useState(false)

  const visible = menu.items.filter(
    (item) =>
      (categoryId === ALL_ITEMS || item.categoryId === categoryId) &&
      item.name.toLowerCase().includes(query.toLowerCase()),
  )

  useEffect(
    () => setSelected((current) => current.filter((id) => menu.items.some((item) => item.id === id))),
    [menu.items],
  )

  const closeItemModal = () => setItemModal({ open: false, item: null })

  const requestDelete = (item: MenuItemVM) => {
    confirm({
      title: `Delete ${item.name}?`,
      description: "This item will be permanently removed from the catalog. Items on past orders must be marked unavailable instead.",
      actionLabel: "Delete item",
      onConfirm: () => {
        void menu.deleteItem(item.id).then((ok) => {
          if (ok) setSelected((current) => current.filter((id) => id !== item.id))
        })
      },
    })
  }

  const requestBulkDelete = () => {
    const count = selected.length
    confirm({
      title: `Delete ${count} menu items?`,
      description: "The selected items will be permanently removed from the catalog. Items on past orders are rejected and must be marked unavailable.",
      actionLabel: "Delete items",
      onConfirm: () => {
        void menu.deleteItems(selected).then((ok) => {
          if (ok) setSelected([])
        })
      },
    })
  }

  return (
    <>
      <PageHeader eyebrow="Menu management" title="Catalog" description="Add, update, and organize the items your guests can order." action="Add menu item" onAction={() => setItemModal({ open: true, item: null })} />

      {menu.error ? (
        <>
          <EmptyState title="We couldn't load the catalog" description={menu.error.message} />
          <div className="flex justify-center">
            <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={menu.refetch}>Try again</button>
          </div>
        </>
      ) : menu.isLoading ? (
        <div className="py-16 text-center text-sm text-muted-2" role="status">Loading catalog…</div>
      ) : (
        <>
          <div className={`${styles["toolbar"]}`}>
            <label className={`${styles["search-box"]}`}><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search menu items" /></label>
            <div className={`${styles["section-tools"]}`}>
              <div className={`${styles["filter-pills"]}`}>
                <button className={categoryId === ALL_ITEMS ? styles["active"] : ""} onClick={() => setCategoryId(ALL_ITEMS)}>All items</button>
                {menu.categories.map((category) => (
                  <button key={category.id} className={categoryId === category.id ? styles["active"] : ""} onClick={() => setCategoryId(category.id)}>{category.name}</button>
                ))}
              </div>
              <button className={`${styles["manage-sections"]}`} onClick={() => setSectionsModalOpen(true)}><Icon name="edit" size={14} />Manage sections</button>
            </div>
          </div>
          {selected.length > 0 && (
            <SelectionBar count={selected.length} onClear={() => setSelected([])}>
              <button type="button" onClick={() => void menu.setAvailability(selected, true)}>Mark available</button>
              <button type="button" onClick={() => void menu.setAvailability(selected, false)}>Mark unavailable</button>
              <button type="button" className={`${styles["danger"]}`} onClick={requestBulkDelete}>Delete</button>
            </SelectionBar>
          )}
          {visible.length === 0 ? (
            <EmptyState title="No menu items found" description="Try changing your search or section filter." />
          ) : <div className={`${styles["catalog-grid"]}`}>
            {visible.map((item) => (
              <article className={`${styles["menu-card"]} ${selected.includes(item.id) ? styles["selected"] : ""}`} key={item.id}>
                <div className={`${styles["menu-image"]}`}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} />
                  ) : (
                    <span className="grid h-full min-h-[150px] place-items-center bg-sand text-[11px] font-bold text-muted" aria-hidden="true">No image</span>
                  )}
                  <label className={`${styles["card-select"]}`} aria-label={`Select ${item.name}`}>
                    <input type="checkbox" checked={selected.includes(item.id)} onChange={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} />
                  </label>
                  <StatusPill tone={item.isAvailable ? "success" : "neutral"} withDot={false} className="absolute left-[45px] top-3">{item.isAvailable ? "Available" : "Unavailable"}</StatusPill>
                  <div className={`${styles["card-actions"]}`}>
                    <button aria-label={`Edit ${item.name}`} onClick={() => setItemModal({ open: true, item })}><Icon name="edit" size={16} /></button>
                    <button className={`${styles["danger"]}`} aria-label={`Delete ${item.name}`} onClick={() => requestDelete(item)}><Icon name="trash" size={16} /></button>
                  </div>
                </div>
                <div className={`${styles["menu-copy"]}`}>
                  <p className={`${styles["category-label"]}`}>{item.categoryName}</p>
                  <div className={`${styles["name-price"]}`}><h3>{item.name}</h3><strong>{formatMoney(item.price, currency)}</strong></div>
                  <p>{item.description}</p>
                </div>
              </article>
            ))}
            <button className={`${styles["add-card"]}`} onClick={() => setItemModal({ open: true, item: null })}><span><Icon name="plus" size={22} /></span><strong>Add a new item</strong><small>Expand your café menu</small></button>
          </div>}
        </>
      )}

      {itemModal.open && (
        <ItemModal
          item={itemModal.item}
          categories={menu.categories}
          restaurantId={restaurant?.id ?? ""}
          onClose={closeItemModal}
          onCreate={menu.createItem}
          onUpdate={menu.updateItem}
        />
      )}
      {sectionsModalOpen && (
        <SectionsModal
          categories={menu.categories}
          items={menu.items}
          onClose={() => setSectionsModalOpen(false)}
          onCreate={menu.createCategory}
          onRename={menu.renameCategory}
          onDelete={menu.deleteCategory}
          onMoveItems={menu.moveItemsToCategory}
          onReorder={menu.reorderCategories}
        />
      )}
    </>
  )
}

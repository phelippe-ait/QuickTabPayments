import { type FormEvent, useEffect, useState } from "react"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { buttonVariants } from "@shared/ui/Button"
import { AdminModal } from "../../components/AdminModal"
import { uploadMenuItemImage, validateImageFile } from "@shared/lib/storage"
import type { TablesUpdate } from "@shared/lib/database.types"
import type { CategoryVM, MenuItemVM } from "../../types"
import type { NewMenuItemInput } from "../../hooks/useMenu"

export function ItemModal({
  item,
  categories,
  restaurantId,
  onClose,
  onCreate,
  onUpdate,
}: {
  item: MenuItemVM | null
  categories: CategoryVM[]
  restaurantId: string
  onClose: () => void
  onCreate: (input: NewMenuItemInput) => Promise<boolean>
  onUpdate: (id: string, patch: TablesUpdate<"menu_items">) => Promise<boolean>
}) {
  const [name, setName] = useState(item?.name ?? "")
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? categories[0]?.id ?? "")
  const [description, setDescription] = useState(item?.description ?? "")
  const [price, setPrice] = useState(item ? String(item.price) : "")
  const [isAvailable, setIsAvailable] = useState(item?.isAvailable ?? true)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(item?.imageUrl ?? null)
  const [imageError, setImageError] = useState("")
  const [formError, setFormError] = useState("")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!imagePreview?.startsWith("blob:")) return
    return () => URL.revokeObjectURL(imagePreview)
  }, [imagePreview])

  const chooseImage = (file: File | undefined) => {
    if (!file) return
    try {
      validateImageFile(file)
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "Choose another image.")
      return
    }
    setImageError("")
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError("")

    const trimmedName = name.trim()
    const priceValue = Number(price)

    if (!trimmedName) {
      setFormError("Item name is required.")
      return
    }
    if (!categoryId) {
      setFormError("Create a section before adding items.")
      return
    }
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      setFormError("Price must be zero or more.")
      return
    }

    setPending(true)
    const id = item?.id ?? crypto.randomUUID()
    let imageUrl = item?.imageUrl ?? null

    try {
      if (imageFile) {
        imageUrl = await uploadMenuItemImage(restaurantId, id, imageFile)
      }

      const ok = item
        ? await onUpdate(item.id, {
            name: trimmedName,
            category_id: categoryId,
            description: description.trim() || null,
            price: priceValue,
            image_url: imageUrl,
            is_available: isAvailable,
          })
        : await onCreate({
            id,
            name: trimmedName,
            categoryId,
            description: description.trim(),
            price: priceValue,
            imageUrl,
            isAvailable,
          })

      if (ok) onClose()
    } catch (error) {
      setImageError(
        error instanceof Error ? error.message : "That image could not be uploaded.",
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <AdminModal labelledBy="item-modal-title" describedBy="item-modal-description" onClose={onClose}>
      <form onSubmit={submit}>
        <p className={`${styles["modal-kicker"]}`}>Catalog</p>
        <h2 id="item-modal-title">{item ? "Edit menu item" : "Add menu item"}</h2>
        <p className={`${styles["modal-description"]}`} id="item-modal-description">Keep the details concise and helpful for your guests.</p>
        <div className={`${styles["form-grid"]}`}>
          <label className={`${styles["wide"]}`}>
            Item image
            <span className="mt-2.5 grid grid-cols-[112px_1fr] gap-4 rounded-[10px] border border-line bg-white p-3.5 max-[480px]:grid-cols-1">
              {imagePreview ? (
                <img className="h-24 w-28 rounded-lg bg-sand object-cover max-[480px]:h-36 max-[480px]:w-full" src={imagePreview} alt={name || "Menu item preview"} />
              ) : (
                <span className="grid h-24 w-28 place-items-center rounded-lg border border-dashed border-line bg-cream-2 text-center text-[10px] font-bold text-muted" aria-hidden="true">
                  No image
                </span>
              )}
              <span className="flex min-w-0 flex-col items-start justify-center">
                <span className="mb-1 block text-[12px] font-bold text-ink-soft">{item ? "Replace image" : "Upload an image"}</span>
                <span className="mb-3 block text-[10px] leading-[1.5] font-normal text-muted">
                  Use a landscape image in a 3:2 ratio, ideally 1200 × 800 px. JPG, PNG, or WebP up to 5 MB.
                </span>
                <span className="inline-flex min-h-9 cursor-pointer items-center justify-center rounded-lg border border-line bg-cream-3 px-3 text-[11px] font-bold text-ink-mid transition-colors hover:border-berry hover:text-berry">
                  Choose image
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ""
                      chooseImage(file)
                    }}
                  />
                </span>
              </span>
            </span>
            {imageError && <small className={`${styles["field-error"]}`} role="alert">{imageError}</small>}
          </label>
          <label className={`${styles["wide"]}`}>Item name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Iced matcha" /></label>
          <label>
            Section
            <select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label>Price ($)<input required min="0" step="0.01" type="number" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
          <label className={`${styles["wide"]}`}>Description<textarea required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A short description of the item" /></label>
          <label className={`${styles["switch-row"]} ${styles["wide"]}`}><span><strong>Available to order</strong><small>Show this item on the customer menu</small></span><input type="checkbox" checked={isAvailable} onChange={(event) => setIsAvailable(event.target.checked)} /></label>
        </div>
        {formError && <p className="mt-3 text-[12px] text-danger" role="alert">{formError}</p>}
        <div className={`${styles["modal-actions"]}`}>
          <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={onClose}>Cancel</button>
          <button className={buttonVariants({ variant: "primary" })} type="submit" disabled={pending || categories.length === 0}>
            {pending ? "Saving…" : item ? "Save changes" : "Add item"}
          </button>
        </div>
      </form>
    </AdminModal>
  )
}

export function SectionsModal({
  categories,
  items,
  onClose,
  onCreate,
  onRename,
  onDelete,
  onMoveItems,
  onReorder,
}: {
  categories: CategoryVM[]
  items: MenuItemVM[]
  onClose: () => void
  onCreate: (name: string) => Promise<boolean>
  onRename: (id: string, name: string) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onMoveItems: (itemIds: string[], categoryId: string) => Promise<boolean>
  onReorder: (orderedIds: string[]) => Promise<boolean>
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [newSection, setNewSection] = useState("")
  const [moveFromId, setMoveFromId] = useState<string | null>(null)
  const [moveTargetId, setMoveTargetId] = useState("")
  const [pending, setPending] = useState(false)

  const moveSource = categories.find((category) => category.id === moveFromId) ?? null
  const movingItems = moveSource
    ? items.filter((item) => item.categoryId === moveSource.id)
    : []
  const moveTargets = categories.filter((category) => category.id !== moveFromId)

  const addSection = async () => {
    const name = newSection.trim()
    if (!name) return
    setPending(true)
    const ok = await onCreate(name)
    setPending(false)
    if (ok) setNewSection("")
  }

  const saveRenames = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    for (const category of categories) {
      const nextName = (drafts[category.id] ?? category.name).trim()
      if (!nextName || nextName === category.name) continue
      const ok = await onRename(category.id, nextName)
      if (!ok) {
        setPending(false)
        return
      }
    }
    setPending(false)
    onClose()
  }

  const deleteSection = async (category: CategoryVM) => {
    const itemCount = items.filter((item) => item.categoryId === category.id).length
    setPending(true)
    const ok = await onDelete(category.id)
    setPending(false)
    if (!ok && itemCount > 0) {
      const targets = categories.filter((entry) => entry.id !== category.id)
      setMoveFromId(category.id)
      setMoveTargetId(targets[0]?.id ?? "")
    }
  }

  const moveAndDelete = async () => {
    if (!moveSource || !moveTargetId) return
    setPending(true)
    const moved = await onMoveItems(
      movingItems.map((item) => item.id),
      moveTargetId,
    )
    if (moved) {
      const deleted = await onDelete(moveSource.id)
      if (deleted) setMoveFromId(null)
    }
    setPending(false)
  }

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= categories.length) return
    const next = [...categories]
    ;[next[index], next[target]] = [next[target], next[index]]
    setPending(true)
    await onReorder(next.map((category) => category.id))
    setPending(false)
  }

  return (
    <AdminModal labelledBy="sections-modal-title" describedBy="sections-modal-description" onClose={onClose} panelClassName={styles["small-modal"]}>
      <form onSubmit={saveRenames}>
        <p className={`${styles["modal-kicker"]}`}>Catalog structure</p>
        <h2 id="sections-modal-title">Manage sections</h2>
        <p className={`${styles["modal-description"]}`} id="sections-modal-description">Sections are referenced by id — renaming one never moves its items. A section with items must be emptied before deletion.</p>
        <div className={`${styles["section-editor"]}`}>
          <p>Current sections</p>
          {categories.map((category, index) => (
            <label key={category.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <input
                required
                aria-label={`Section ${index + 1} name`}
                value={drafts[category.id] ?? category.name}
                onChange={(event) => setDrafts({ ...drafts, [category.id]: event.target.value })}
              />
              <div className={styles["section-actions"]}>
                <button type="button" disabled={pending || index === 0} aria-label={`Move ${category.name} up`} title="Move up" onClick={() => void move(index, -1)}>↑</button>
                <button type="button" disabled={pending || index === categories.length - 1} aria-label={`Move ${category.name} down`} title="Move down" onClick={() => void move(index, 1)}>↓</button>
                <button
                  type="button"
                  disabled={pending || categories.length === 1}
                  aria-label={`Delete ${category.name}`}
                  title={categories.length === 1 ? "At least one section is required" : `Delete ${category.name}`}
                  onClick={() => void deleteSection(category)}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            </label>
          ))}
          <small>Renaming is a single-row update; items keep their category id. Deleting is blocked while items reference the section.</small>
        </div>

        {moveSource && (
          <div className="mt-4 rounded-[9px] border border-line bg-cream-2 p-4" role="group" aria-label="Move items before deleting">
            <p className="text-[11px] font-bold text-ink-mid">
              “{moveSource.name}” still has {movingItems.length} {movingItems.length === 1 ? "item" : "items"}.
            </p>
            {moveTargets.length === 0 ? (
              <p className="mt-2 text-[10px] text-muted">Create another section before deleting this one.</p>
            ) : (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="text-[10px] font-bold text-ink-mid">
                  Move its items to
                  <select
                    className="mt-1 block rounded-lg border border-line bg-white px-3 py-2 text-[12px]"
                    value={moveTargetId}
                    onChange={(event) => setMoveTargetId(event.target.value)}
                  >
                    {moveTargets.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })} disabled={pending || !moveTargetId} onClick={() => void moveAndDelete()}>Move & delete</button>
                <button type="button" className={buttonVariants({ variant: "ghost", size: "sm" })} onClick={() => setMoveFromId(null)}>Cancel</button>
              </div>
            )}
          </div>
        )}

        <div className={`${styles["new-section"]}`}>
          <label>
            New section
            <span>
              <input value={newSection} onChange={(event) => setNewSection(event.target.value)} placeholder="e.g. Pastries" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addSection() } }} />
              <button type="button" disabled={pending || !newSection.trim()} onClick={() => void addSection()}><Icon name="plus" size={15} />Add</button>
            </span>
          </label>
        </div>
        <div className={`${styles["modal-actions"]}`}>
          <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={onClose}>Cancel</button>
          <button className={buttonVariants({ variant: "primary" })} type="submit" disabled={pending}>Save sections</button>
        </div>
      </form>
    </AdminModal>
  )
}

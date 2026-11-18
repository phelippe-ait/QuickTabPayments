import { type FormEvent, useState } from "react"
import styles from "../../App.module.css"
import { AdminModal } from "../../components/AdminModal"
import { useAdminUi } from "../../hooks/AdminUiProvider"
import { Icon } from "@shared/ui/Icon"
import { Badge } from "@shared/ui/shadcn/badge"
import { buttonVariants } from "@shared/ui/Button"
import { cn } from "@shared/lib/cn"
import { formatMoney } from "@shared/lib/money"
import type { ModifierGroupWithOptions } from "@shared/data/modifiers"
import type {
  MenuItemModifierGroup,
  ModifierSelection,
  TablesUpdate,
} from "@shared/lib/database.types"
import type {
  NewModifierGroupInput,
  NewModifierInput,
} from "../../hooks/useModifiers"
import type { MenuItemVM } from "../../viewModels"
import {
  normaliseModifierGroup,
  parsePriceAdjustment,
} from "./modifierValidation"

type GroupDraft = {
  name: string
  selectionType: ModifierSelection
  isRequired: boolean
  minSelections: string
  maxSelections: string
  displayOrder: string
}

type OptionDraft = {
  name: string
  price: string
}

type EditingGroup = {
  id: string
  draft: GroupDraft
}

export type ModifierDialogProps = {
  item: MenuItemVM
  currency: string
  groups: ModifierGroupWithOptions[]
  links: MenuItemModifierGroup[]
  isLoading: boolean
  error: Error | null
  onRetry: () => void
  onClose: () => void
  onCreateGroup: (input: NewModifierGroupInput) => Promise<boolean>
  onUpdateGroup: (
    id: string,
    patch: TablesUpdate<"modifier_groups">,
  ) => Promise<boolean>
  onDeleteGroup: (id: string) => Promise<boolean>
  onAddModifier: (input: NewModifierInput) => Promise<boolean>
  onUpdateOption: (
    id: string,
    patch: TablesUpdate<"modifiers">,
  ) => Promise<boolean>
  onDeleteOption: (id: string) => Promise<boolean>
  onReorderOptions: (orderedIds: string[]) => Promise<boolean>
  onSetGroupLink: (
    menuItemId: string,
    groupId: string,
    linked: boolean,
  ) => Promise<boolean>
}

function emptyGroupDraft(displayOrder: number): GroupDraft {
  return {
    name: "",
    selectionType: "single",
    isRequired: false,
    minSelections: "0",
    maxSelections: "1",
    displayOrder: String(displayOrder),
  }
}

function groupToDraft(group: ModifierGroupWithOptions): GroupDraft {
  return {
    name: group.name,
    selectionType: group.selection_type,
    isRequired: group.is_required,
    minSelections: String(group.min_selections),
    // 0 on a multiple group means "no limit".
    maxSelections:
      group.selection_type === "multiple" && group.max_selections === 0
        ? ""
        : String(group.max_selections),
    displayOrder: String(group.display_order),
  }
}

function priceAdjustmentLabel(value: number, currency: string): string {
  if (value === 0) return "No change"
  const formatted = formatMoney(Math.abs(value), currency)
  return value > 0 ? `+${formatted}` : `-${formatted}`
}

function nextOptionOrder(group: ModifierGroupWithOptions): number {
  return group.modifiers.length
    ? Math.max(...group.modifiers.map((option) => option.display_order)) + 1
    : 0
}

/**
 * Per-item modifier editor. Creating a group makes it available to every item
 * in the restaurant; the checkbox list controls which groups this item offers.
 */
export function ModifierDialog({
  item,
  currency,
  groups,
  links,
  isLoading,
  error,
  onRetry,
  onClose,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onAddModifier,
  onUpdateOption,
  onDeleteOption,
  onReorderOptions,
  onSetGroupLink,
}: ModifierDialogProps) {
  const { confirm } = useAdminUi()
  const defaultOrder = groups.length
    ? Math.max(...groups.map((group) => group.display_order)) + 1
    : 0

  const [newGroup, setNewGroup] = useState<GroupDraft>(() =>
    emptyGroupDraft(defaultOrder),
  )
  const [editing, setEditing] = useState<EditingGroup | null>(null)
  const [optionDrafts, setOptionDrafts] = useState<Record<string, OptionDraft>>(
    {},
  )
  const [formError, setFormError] = useState("")
  const [status, setStatus] = useState("")
  const [pending, setPending] = useState(false)

  const attachedIds = new Set(
    links
      .filter((link) => link.menu_item_id === item.id)
      .map((link) => link.modifier_group_id),
  )
  const attachedGroups = groups.filter((group) => attachedIds.has(group.id))

  const announce = (message: string) => {
    setFormError("")
    setStatus(message)
  }

  const fail = (message: string) => {
    setStatus("")
    setFormError(message)
  }

  const saveGroup = async (
    draft: GroupDraft,
    onSave: (group: {
      name: string
      selectionType: ModifierSelection
      isRequired: boolean
      minSelections: number
      maxSelections: number
      displayOrder: number
    }) => Promise<boolean>,
    successMessage: string,
  ) => {
    const validation = normaliseModifierGroup({
      name: draft.name,
      selectionType: draft.selectionType,
      isRequired: draft.isRequired,
      minSelections: draft.minSelections === "" ? 0 : draft.minSelections,
      maxSelections: draft.maxSelections,
    })
    if (!validation.ok) {
      fail(validation.error)
      return false
    }

    const displayOrder = Number(draft.displayOrder)
    if (!Number.isInteger(displayOrder) || displayOrder < 0) {
      fail("Display order must be a whole number of zero or more.")
      return false
    }

    setPending(true)
    const ok = await onSave({ ...validation.group, displayOrder })
    setPending(false)

    if (ok) announce(successMessage)
    else fail("The group could not be saved.")
    return ok
  }

  const submitNewGroup = async (event: FormEvent) => {
    event.preventDefault()
    const name = newGroup.name.trim()
    const ok = await saveGroup(
      newGroup,
      (group) => onCreateGroup(group),
      `Group ${name} created`,
    )
    if (ok) setNewGroup(emptyGroupDraft(defaultOrder + 1))
  }

  const submitGroupEdit = async (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return
    const group = groups.find((entry) => entry.id === editing.id)
    const ok = await saveGroup(
      editing.draft,
      (draft) =>
        onUpdateGroup(editing.id, {
          name: draft.name,
          selection_type: draft.selectionType,
          is_required: draft.isRequired,
          min_selections: draft.minSelections,
          max_selections: draft.maxSelections,
          display_order: draft.displayOrder,
        }),
      `${group?.name ?? "Group"} saved`,
    )
    if (ok) setEditing(null)
  }

  const toggleLink = async (group: ModifierGroupWithOptions, linked: boolean) => {
    setPending(true)
    const ok = await onSetGroupLink(item.id, group.id, linked)
    setPending(false)
    if (ok) {
      announce(linked ? `${group.name} attached` : `${group.name} detached`)
    } else {
      fail("The group attachment could not be updated.")
    }
  }

  const submitNewOption = async (
    event: FormEvent,
    group: ModifierGroupWithOptions,
  ) => {
    event.preventDefault()
    const draft = optionDrafts[group.id] ?? { name: "", price: "" }
    const name = draft.name.trim()

    if (!name) {
      fail("Option name is required.")
      return
    }

    const parsed = parsePriceAdjustment(draft.price)
    if (parsed === null && draft.price.trim() !== "") {
      fail("Price adjustment must be a number.")
      return
    }

    setPending(true)
    const ok = await onAddModifier({
      groupId: group.id,
      name,
      priceAdjustment: parsed ?? 0,
      isAvailable: true,
      displayOrder: nextOptionOrder(group),
    })
    setPending(false)

    if (ok) {
      setOptionDrafts({ ...optionDrafts, [group.id]: { name: "", price: "" } })
      announce(`Option ${name} added`)
    } else {
      fail("The option could not be added.")
    }
  }

  const toggleAvailability = async (
    optionId: string,
    optionName: string,
    isAvailable: boolean,
  ) => {
    setPending(true)
    const ok = await onUpdateOption(optionId, { is_available: isAvailable })
    setPending(false)
    if (ok) {
      announce(`${optionName} ${isAvailable ? "available" : "unavailable"}`)
    } else {
      fail("The option could not be updated.")
    }
  }

  const moveOption = async (
    group: ModifierGroupWithOptions,
    index: number,
    direction: -1 | 1,
  ) => {
    const target = index + direction
    if (target < 0 || target >= group.modifiers.length) return

    const next = [...group.modifiers]
    ;[next[index], next[target]] = [next[target], next[index]]

    setPending(true)
    const ok = await onReorderOptions(next.map((option) => option.id))
    setPending(false)
    if (ok) announce("Option order updated")
    else fail("The option order could not be updated.")
  }

  const removeOption = (optionId: string, optionName: string) => {
    confirm({
      title: `Delete “${optionName}”?`,
      description:
        "Guests will no longer see this option. Past orders keep their snapshot.",
      actionLabel: "Delete option",
      onConfirm: () => {
        void (async () => {
          setPending(true)
          const ok = await onDeleteOption(optionId)
          setPending(false)
          if (ok) announce(`Option ${optionName} deleted`)
          else fail("The option could not be deleted.")
        })()
      },
    })
  }

  const removeGroup = (group: ModifierGroupWithOptions) => {
    confirm({
      title: `Delete “${group.name}”?`,
      description:
        "Its options and item attachments are removed. Past orders keep their snapshots.",
      actionLabel: "Delete group",
      onConfirm: () => {
        void (async () => {
          setPending(true)
          const ok = await onDeleteGroup(group.id)
          setPending(false)
          if (ok) {
            if (editing?.id === group.id) setEditing(null)
            announce(`Group ${group.name} deleted`)
          } else {
            fail("The group could not be deleted.")
          }
        })()
      },
    })
  }

  return (
    <AdminModal
      labelledBy="modifier-modal-title"
      describedBy="modifier-modal-description"
      onClose={onClose}
      panelClassName="w-[min(760px,100%)]"
    >
      <p className={`${styles["modal-kicker"]}`}>Catalog</p>
      <h2 id="modifier-modal-title">Modifiers for {item.name}</h2>
      <p className={`${styles["modal-description"]}`} id="modifier-modal-description">
        Attach groups to this item, then manage their options. Option prices are
        added to the item&apos;s price; negative adjustments are discounts.
      </p>

      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>

      {error ? (
        <div className="rounded-[10px] border border-line bg-white p-4">
          <p className="text-[12px] font-bold text-ink-soft">
            We couldn&apos;t load modifiers
          </p>
          <p className="mt-1 text-[11px] text-muted">{error.message}</p>
          <button
            type="button"
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-3")}
            onClick={onRetry}
          >
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3" role="status" aria-label="Loading modifiers">
          <span className="sr-only">Loading modifiers…</span>
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-16 animate-pulse rounded-[10px] bg-line-soft" />
          ))}
        </div>
      ) : (
        <>
          <fieldset className="rounded-[10px] border border-line bg-white p-4">
            <legend className="px-1 text-[11px] font-bold text-ink-mid">
              Groups on this item
            </legend>
            {groups.length === 0 ? (
              <p className="mt-1 text-[11px] text-muted">
                No groups yet. Create the first one below.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {groups.map((group) => {
                  const linked = attachedIds.has(group.id)
                  return (
                    <label
                      key={group.id}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line-soft bg-paper px-3 py-1.5 text-[11px] font-medium text-ink-mid"
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-berry"
                        checked={linked}
                        disabled={pending}
                        aria-label={`${linked ? "Detach" : "Attach"} ${group.name}`}
                        onChange={(event) =>
                          void toggleLink(group, event.target.checked)
                        }
                      />
                      {group.name}
                      <span className="text-[9px] text-muted">
                        {group.modifiers.length}{" "}
                        {group.modifiers.length === 1 ? "option" : "options"}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </fieldset>

          {attachedGroups.length === 0 ? (
            <p className="mt-4 rounded-[10px] border border-dashed border-line p-4 text-[11px] text-muted">
              Attach a group above to choose its options for this item.
            </p>
          ) : (
            attachedGroups.map((group) => (
              <section
                key={group.id}
                className="mt-4 rounded-[10px] border border-line bg-white p-4"
                aria-labelledby={`modifier-group-${group.id}-title`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    id={`modifier-group-${group.id}-title`}
                    className="min-w-0 flex-1 text-[13px] font-bold text-ink-soft"
                  >
                    {group.name}
                  </h3>
                  <Badge variant="neutral">
                    {group.selection_type === "single" ? "Single" : "Multiple"}
                  </Badge>
                  {group.is_required && <Badge variant="warning">Required</Badge>}
                  <button
                    type="button"
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "px-2")}
                    aria-label={`Edit ${group.name}`}
                    onClick={() =>
                      setEditing(
                        editing?.id === group.id
                          ? null
                          : { id: group.id, draft: groupToDraft(group) },
                      )
                    }
                  >
                    <Icon name="edit" size={14} />
                  </button>
                  <button
                    type="button"
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "px-2 text-berry-deep")}
                    aria-label={`Delete ${group.name}`}
                    disabled={pending}
                    onClick={() => removeGroup(group)}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>

                {editing?.id === group.id && (
                  <form onSubmit={submitGroupEdit}>
                    <GroupFields
                      draft={editing.draft}
                      onChange={(draft) =>
                        setEditing({ id: group.id, draft })
                      }
                      idPrefix={`edit-group-${group.id}`}
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        className={buttonVariants({ variant: "secondary", size: "sm" })}
                        onClick={() => setEditing(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className={buttonVariants({ variant: "primary", size: "sm" })}
                        disabled={pending}
                      >
                        Save group
                      </button>
                    </div>
                  </form>
                )}

                {group.modifiers.length === 0 ? (
                  <p className="mt-3 text-[11px] text-muted">
                    No options yet. Add the first one below.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-line-soft border-y border-line-soft">
                    {group.modifiers.map((option, index) => (
                      <li
                        key={option.id}
                        className="flex flex-wrap items-center gap-2 py-2"
                      >
                        <span className="min-w-0 flex-1 text-[12px] font-bold text-ink-soft">
                          {option.name}
                        </span>
                        <span className="text-[11px] text-berry-strong">
                          {priceAdjustmentLabel(option.price_adjustment, currency)}
                        </span>
                        <label className="inline-flex items-center gap-1 text-[10px] font-bold text-muted">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-berry"
                            checked={option.is_available}
                            disabled={pending}
                            aria-label={`${option.name} available`}
                            onChange={(event) =>
                              void toggleAvailability(
                                option.id,
                                option.name,
                                event.target.checked,
                              )
                            }
                          />
                          Available
                        </label>
                        <button
                          type="button"
                          className="grid h-7 w-7 place-items-center rounded-md border border-line text-berry"
                          aria-label={`Move ${option.name} up`}
                          disabled={pending || index === 0}
                          onClick={() => void moveOption(group, index, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="grid h-7 w-7 place-items-center rounded-md border border-line text-berry"
                          aria-label={`Move ${option.name} down`}
                          disabled={pending || index === group.modifiers.length - 1}
                          onClick={() => void moveOption(group, index, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="grid h-7 w-7 place-items-center rounded-md border border-line text-berry-deep"
                          aria-label={`Delete ${option.name}`}
                          disabled={pending}
                          onClick={() => removeOption(option.id, option.name)}
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <form
                  className="mt-3 flex flex-wrap items-end gap-2"
                  onSubmit={(event) => void submitNewOption(event, group)}
                >
                  <label className="min-w-[160px] flex-1 text-[10px] font-bold text-ink-mid">
                    New option
                    <input
                      required
                      className="mt-1 block w-full rounded-lg border border-line bg-white px-3 py-2 text-[12px] font-normal"
                      value={optionDrafts[group.id]?.name ?? ""}
                      placeholder="e.g. Oat milk"
                      onChange={(event) =>
                        setOptionDrafts({
                          ...optionDrafts,
                          [group.id]: {
                            ...(optionDrafts[group.id] ?? { price: "" }),
                            name: event.target.value,
                          },
                        })
                      }
                    />
                  </label>
                  <label className="w-28 text-[10px] font-bold text-ink-mid">
                    Price change
                    <input
                      className="mt-1 block w-full rounded-lg border border-line bg-white px-3 py-2 text-[12px] font-normal"
                      type="number"
                      step="0.01"
                      value={optionDrafts[group.id]?.price ?? ""}
                      placeholder="0.00"
                      onChange={(event) =>
                        setOptionDrafts({
                          ...optionDrafts,
                          [group.id]: {
                            ...(optionDrafts[group.id] ?? { name: "" }),
                            price: event.target.value,
                          },
                        })
                      }
                    />
                  </label>
                  <button
                    type="submit"
                    className={buttonVariants({ variant: "secondary", size: "sm" })}
                    disabled={pending}
                  >
                    Add option
                  </button>
                </form>
              </section>
            ))
          )}

          <form
            className="mt-4 rounded-[10px] border border-line-soft bg-cream-2 p-4"
            onSubmit={submitNewGroup}
          >
            <p className="text-[11px] font-bold text-ink-mid">Create a group</p>
            <GroupFields
              draft={newGroup}
              onChange={setNewGroup}
              idPrefix="new-group"
              includeDisplayOrder
            />
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                className={buttonVariants({ variant: "primary", size: "sm" })}
                disabled={pending}
              >
                Create group
              </button>
            </div>
          </form>
        </>
      )}

      {formError && (
        <p className="mt-3 text-[12px] text-danger" role="alert">
          {formError}
        </p>
      )}

      <div className={`${styles["modal-actions"]}`}>
        <button
          type="button"
          className={buttonVariants({ variant: "secondary" })}
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </AdminModal>
  )
}

function GroupFields({
  draft,
  onChange,
  idPrefix,
  includeDisplayOrder = false,
}: {
  draft: GroupDraft
  onChange: (draft: GroupDraft) => void
  idPrefix: string
  includeDisplayOrder?: boolean
}) {
  const changeSelectionType = (selectionType: ModifierSelection) => {
    if (selectionType === "single") {
      const min = Number(draft.minSelections)
      onChange({
        ...draft,
        selectionType,
        minSelections: String(Math.min(Number.isFinite(min) ? min : 0, 1)),
        maxSelections: "1",
      })
      return
    }

    onChange({ ...draft, selectionType })
  }

  return (
    <div className={`${styles["form-grid"]} mt-3`}>
      <label className={`${styles["wide"]}`}>
        Group name
        <input
          id={`${idPrefix}-name`}
          required
          value={draft.name}
          placeholder="e.g. Size"
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
      </label>
      <label>
        Selection type
        <select
          id={`${idPrefix}-type`}
          value={draft.selectionType}
          onChange={(event) =>
            changeSelectionType(event.target.value as ModifierSelection)
          }
        >
          <option value="single">Single choice</option>
          <option value="multiple">Multiple choices</option>
        </select>
      </label>
      <label>
        Minimum selections
        <input
          id={`${idPrefix}-min`}
          type="number"
          min="0"
          step="1"
          value={draft.minSelections}
          onChange={(event) =>
            onChange({ ...draft, minSelections: event.target.value })
          }
        />
      </label>
      <label>
        Maximum selections
        <input
          id={`${idPrefix}-max`}
          type="number"
          min="0"
          step="1"
          value={draft.maxSelections}
          placeholder="No limit"
          disabled={draft.selectionType === "single"}
          onChange={(event) =>
            onChange({ ...draft, maxSelections: event.target.value })
          }
        />
        <small className="mt-1.5 block text-[10px] font-normal text-muted">
          Single-choice groups always allow 1. Leave blank on multiple-choice
          groups for no limit.
        </small>
      </label>
      {includeDisplayOrder && (
        <label>
          Display order
          <input
            id={`${idPrefix}-order`}
            type="number"
            min="0"
            step="1"
            value={draft.displayOrder}
            onChange={(event) =>
              onChange({ ...draft, displayOrder: event.target.value })
            }
          />
        </label>
      )}
      <label className={`${styles["switch-row"]} ${styles["wide"]}`}>
        <span>
          <strong>Required</strong>
          <small>Guests must choose before adding this item</small>
        </span>
        <input
          type="checkbox"
          aria-label="Required group"
          checked={draft.isRequired}
          onChange={(event) =>
            onChange({ ...draft, isRequired: event.target.checked })
          }
        />
      </label>
    </div>
  )
}

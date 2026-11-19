import { useState } from "react"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { formatMoney } from "@shared/lib/money"
import { useBodyScrollLock, useDialogFocus } from "@shared/ui/useDialogFocus"
import {
  defaultModifierSelection,
  previewLineTotal,
  previewUnitPrice,
  selectedModifierChoices,
  selectionBounds,
  validateModifierSelection,
  type ModifierSelection,
} from "@shared/orders/modifierSelection"
import type {
  OrderingMenuItem,
  OrderingModifierChoice,
  OrderingModifierGroup,
} from "@shared/orders/orderingTypes"

/**
 * Staff-side product picker. It deliberately mirrors the customer
 * `ProductModal` selection rules through the shared modifier helpers, so an
 * order entered at the counter can never group or price lines differently.
 */
export function StaffProductDialog({
  item,
  currency,
  onClose,
  onAdd,
}: {
  item: OrderingMenuItem
  currency: string
  onClose: () => void
  onAdd: (quantity: number, modifiers: OrderingModifierChoice[]) => void
}) {
  const groups = item.modifierGroups ?? []
  const [quantity, setQuantity] = useState(1)
  const [selectedOptions, setSelectedOptions] = useState<ModifierSelection>(
    () => defaultModifierSelection(groups),
  )
  const validation = validateModifierSelection(groups, selectedOptions)
  const unitPrice = previewUnitPrice(item.price, groups, selectedOptions)
  const lineTotal = previewLineTotal(
    item.price,
    groups,
    selectedOptions,
    quantity,
  )
  const panelRef = useDialogFocus<HTMLElement>(onClose)
  useBodyScrollLock()

  function toggleOption(group: OrderingModifierGroup, optionId: string) {
    setSelectedOptions((current) => {
      const selected = current[group.id] ?? []
      if (group.selectionType === "single") {
        return { ...current, [group.id]: [optionId] }
      }
      if (selected.includes(optionId)) {
        return {
          ...current,
          [group.id]: selected.filter((id) => id !== optionId),
        }
      }
      const { maximum } = selectionBounds(group)
      if (selected.length >= maximum) return current
      return { ...current, [group.id]: [...selected, optionId] }
    })
  }

  return (
    <>
      <button
        aria-label="Close item options"
        className="fixed inset-0 z-40 cursor-default bg-ink/20 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-product-title"
        className={`${styles["drawer-scroll"]} fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-paper p-6 shadow-2xl sm:w-[460px] sm:p-8`}
      >
        <div className="flex items-center justify-between">
          <p className={styles["eyebrow"]}>Add item</p>
          <button
            aria-label="Close"
            className="grid h-11 w-11 place-items-center rounded-full border border-line hover:bg-cream-2"
            onClick={onClose}
            type="button"
          >
            <Icon name="close" size={17} />
          </button>
        </div>

        <div className="mt-8 border-b border-line pb-6">
          <h2 className="font-serif text-3xl" id="staff-product-title">
            {item.name}
          </h2>
          {item.description && (
            <p className="mt-2 text-sm text-muted-2">{item.description}</p>
          )}
          <p className="mt-3 font-serif text-2xl">
            {formatMoney(item.price, currency)}
          </p>
          {item.allergens.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              <span className="font-bold">Contains:</span>{" "}
              {item.allergens
                .map((tag) => tag.replace(/\b\w/g, (letter) => letter.toUpperCase()))
                .join(", ")}
            </p>
          )}
        </div>

        {groups.map((group) => {
          const { minimum, maximum } = selectionBounds(group)
          const selectedCount = selectedOptions[group.id]?.length ?? 0
          const atMaximum = selectedCount >= maximum
          const hint =
            group.selectionType === "single"
              ? minimum > 0
                ? "Choose one"
                : "Choose up to one"
              : minimum > 0
                ? Number.isFinite(maximum) && maximum > minimum
                  ? `Choose ${minimum}–${maximum}`
                  : `Choose at least ${minimum}`
                : Number.isFinite(maximum)
                  ? `Choose up to ${maximum}`
                  : "Choose any"

          return (
            <fieldset className="mt-6" key={group.id}>
              <legend className="flex w-full items-baseline justify-between gap-3 text-sm font-bold">
                <span>{group.name}</span>
                <small className="text-[11px] font-medium text-muted">
                  {hint}
                  {group.isRequired && " · Required"}
                </small>
              </legend>
              <div className="mt-2 space-y-2">
                {group.options.map((option) => {
                  const checked =
                    selectedOptions[group.id]?.includes(option.id) ?? false
                  return (
                    <label
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5 text-sm transition has-[:checked]:border-berry has-[:checked]:bg-cream-2"
                      key={option.id}
                    >
                      <input
                        type={
                          group.selectionType === "single"
                            ? "radio"
                            : "checkbox"
                        }
                        name={`staff-modifier-${group.id}`}
                        checked={checked}
                        disabled={
                          group.options.length === 0 ||
                          (group.selectionType === "multiple" &&
                            !checked &&
                            atMaximum)
                        }
                        onChange={() => toggleOption(group, option.id)}
                      />
                      <span className="flex-1">{option.name}</span>
                      {option.priceAdjustment !== 0 && (
                        <strong className="text-xs text-muted">
                          {option.priceAdjustment > 0 ? "+" : "−"}
                          {formatMoney(
                            Math.abs(option.priceAdjustment),
                            currency,
                          )}
                        </strong>
                      )}
                    </label>
                  )
                })}
                {group.options.length === 0 && (
                  <p className="text-xs text-muted">
                    No options are currently available.
                  </p>
                )}
              </div>
              {minimum > 0 && selectedCount < minimum && (
                <p className="mt-2 text-xs text-muted" role="alert">
                  Select at least {minimum} option
                  {minimum === 1 ? "" : "s"}.
                </p>
              )}
            </fieldset>
          )
        })}

        {!validation.ok && groups.length > 0 && (
          <p className="mt-4 text-xs text-danger" role="alert">
            {validation.message}
          </p>
        )}

        <div className="mt-8 border-t border-line pt-5">
          <div
            className="flex items-center justify-between rounded-xl border border-line bg-white p-2"
            role="group"
            aria-label={`Quantity for ${item.name}`}
          >
            <button
              type="button"
              aria-label={`Decrease quantity of ${item.name}`}
              className="grid h-11 w-11 place-items-center rounded-lg bg-cream-2 text-xl font-medium transition hover:bg-line-soft disabled:cursor-not-allowed disabled:opacity-40"
              disabled={quantity <= 1}
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
            >
              −
            </button>
            <span className="text-sm font-bold" aria-live="polite">
              <span className="sr-only">{item.name} quantity </span>
              {quantity}
            </span>
            <button
              type="button"
              aria-label={`Increase quantity of ${item.name}`}
              className="grid h-11 w-11 place-items-center rounded-lg bg-cream-2 text-xl font-medium transition hover:bg-line-soft"
              onClick={() => setQuantity((current) => current + 1)}
            >
              +
            </button>
          </div>

          <button
            type="button"
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-berry px-4 py-3 text-sm font-bold text-white transition hover:bg-berry-strong disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!validation.ok}
            onClick={() =>
              onAdd(quantity, selectedModifierChoices(groups, selectedOptions))
            }
          >
            <Icon name="plus" size={16} />
            Add to order · {formatMoney(lineTotal, currency)}
            {quantity > 1
              ? ` (${formatMoney(unitPrice, currency)} each)`
              : ""}
          </button>
        </div>
      </aside>
    </>
  )
}

import { useState } from "react"
import styles from "../../App.module.css"
import { Button } from "@shared/ui/Button"
import { formatMoney } from "@shared/lib/money"
import { useBodyScrollLock, useDialogFocus } from "@shared/ui/useDialogFocus"
import { HeaderButton } from "../../components/CustomerUi"
import { ProductPhoto } from "./ProductPhoto"
import {
  defaultModifierSelection,
  previewLineTotal,
  previewUnitPrice,
  selectedModifierChoices,
  selectionBounds,
  validateModifierSelection,
  type ModifierSelection,
} from "./modifierSelection"
import type { MenuItem, ModifierChoice, ModifierGroup } from "../../types"

export function ProductModal({
  item,
  currency,
  onClose,
  onAdd,
}: {
  item: MenuItem;
  currency: string;
  onClose: () => void;
  onAdd: (quantity: number, modifiers: ModifierChoice[]) => void;
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

  const toggleOption = (group: ModifierGroup, optionId: string) => {
    setSelectedOptions((current) => {
      const selected = current[group.id] ?? []
      if (group.selectionType === "single") {
        // Radios always hold exactly one value; a second pick replaces the first.
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
    <div
      className={`${styles["modal-shade"]}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panelRef}
        className={`${styles["product-modal"]}`}
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
      >
        <div className={`${styles["modal-close"]}`}>
          <HeaderButton
            icon="close"
            label="Close product details"
            onClick={onClose}
          />
        </div>
        <ProductPhoto item={item} large />
        <h2>{item.name}</h2>
        <p>{item.description || "Ask our team about this item."}</p>
        <div className={`${styles["modal-price"]}`}>
          {formatMoney(item.price, currency)}
        </div>
        {item.dietaryTags.length > 0 && (
          <div className={`${styles["modal-tags"]}`} aria-label="Dietary tags">
            {item.dietaryTags.map((tag) => <span className={`${styles["menu-tag"]} ${styles["dietary-tag"]}`} key={tag}>{tag.replace(/\b\w/g, (letter) => letter.toUpperCase())}</span>)}
          </div>
        )}
        {item.allergens.length > 0 && (
          <p className={`${styles["modal-meta"]}`}>
            <strong>Contains:</strong> {item.allergens.map((tag) => tag.replace(/\b\w/g, (letter) => letter.toUpperCase())).join(", ")}
          </p>
        )}
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
            <fieldset className={styles["modifier-group"]} key={group.id}>
              <legend>
                <span>{group.name}</span>
                <small>
                  {hint}
                  {group.isRequired && <b> Required</b>}
                </small>
              </legend>
              {group.options.map((option) => {
                const checked = selectedOptions[group.id]?.includes(option.id) ?? false
                return (
                  <label className={styles["modifier-option"]} key={option.id}>
                    <input
                      type={group.selectionType === "single" ? "radio" : "checkbox"}
                      name={`modifier-${group.id}`}
                      checked={checked}
                      disabled={group.options.length === 0 || (
                        group.selectionType === "multiple" && !checked && atMaximum
                      )}
                      onChange={() => toggleOption(group, option.id)}
                    />
                    <span>{option.name}</span>
                    {option.priceAdjustment !== 0 && (
                      <strong>{option.priceAdjustment > 0 ? "+" : "−"}{formatMoney(Math.abs(option.priceAdjustment), currency)}</strong>
                    )}
                  </label>
                )
              })}
              {group.options.length === 0 && (
                <p className={styles["modifier-hint"]}>No options are currently available.</p>
              )}
              {minimum > 0 && selectedCount < minimum && (
                <p className={styles["modifier-hint"]}>Select at least {minimum} option{minimum === 1 ? "" : "s"}.</p>
              )}
            </fieldset>
          )
        })}
        {!validation.ok && groups.length > 0 && (
          <p className={styles["modifier-hint"]} role="alert">
            {validation.message}
          </p>
        )}
        <div className={`${styles["modal-footer"]}`}>
          <div className={`${styles["quantity"]}`} role="group" aria-label={`Quantity for ${item.name}`}>
            <button
              type="button"
              aria-label={`Decrease quantity of ${item.name}`}
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
            >
              −
            </button>
            <span aria-live="polite">
              <span className="sr-only">{item.name} quantity </span>
              {quantity}
            </span>
            <button
              type="button"
              aria-label={`Increase quantity of ${item.name}`}
              onClick={() => setQuantity(quantity + 1)}
            >
              +
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-[5px]"
            disabled={!validation.ok}
            onClick={() =>
              onAdd(quantity, selectedModifierChoices(groups, selectedOptions))
            }
          >
            Add to Order · {formatMoney(lineTotal, currency)}
            {quantity > 1 ? ` (${formatMoney(unitPrice, currency)} each)` : ""}
          </Button>
        </div>
      </section>
    </div>
  );
}

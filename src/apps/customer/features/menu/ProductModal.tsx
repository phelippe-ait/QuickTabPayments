import { useCallback, useEffect, useMemo, useState } from "react"
import styles from "../../App.module.css"
import { Button } from "@shared/ui/Button"
import { formatMoney } from "@shared/lib/money"
import { useBodyScrollLock, useDialogFocus } from "@shared/ui/useDialogFocus"
import { HeaderButton } from "../../components/CustomerUi"
import { ProductPhoto } from "./ProductPhoto"
import { fetchItemModifierGroups } from "../../data/menuApi"
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
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState("");
  const selectedOptionCount = useMemo(
    () => Object.values(selectedOptions).reduce((count, ids) => count + ids.length, 0),
    [selectedOptions],
  );
  const missingRequiredGroup = groups.find((group) => {
    const minimum = group.isRequired ? Math.max(1, group.minSelections) : group.minSelections;
    return (selectedOptions[group.id]?.length ?? 0) < minimum;
  });
  const invalidGroup = groups.find((group) => {
    const maximum = group.selectionType === "single" ? 1 : group.maxSelections;
    return (selectedOptions[group.id]?.length ?? 0) > maximum;
  });
  const selectedUpcharge = groups.reduce(
    (total, group) => total + group.options
      .filter((option) => selectedOptions[group.id]?.includes(option.id))
      .reduce((sum, option) => sum + option.priceAdjustment, 0),
    0,
  );
  const panelRef = useDialogFocus<HTMLElement>(onClose);
  useBodyScrollLock();

  const loadOptions = useCallback(() => {
    setOptionsLoading(true);
    setOptionsError("");
    void fetchItemModifierGroups(item.id)
      .then(setGroups)
      .catch((error: unknown) => {
        setOptionsError(error instanceof Error ? error.message : "Could not load item options. Please try again.");
      })
      .finally(() => setOptionsLoading(false));
  }, [item.id]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const toggleOption = (groupId: string, optionId: string, maximum: number) => {
    setSelectedOptions((current) => {
      const selected = current[groupId] ?? [];
      if (selected.includes(optionId)) {
        return { ...current, [groupId]: selected.filter((id) => id !== optionId) };
      }
      if (selected.length >= maximum) {
        return { ...current, [groupId]: maximum === 1 ? [optionId] : selected };
      }
      return { ...current, [groupId]: [...selected, optionId] };
    });
  };

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
        {optionsLoading && (
          <p className={styles["option-loading"]} role="status">Loading options…</p>
        )}
        {optionsError && (
          <div className={styles["option-error"]} role="alert">
            {optionsError}
            <button type="button" onClick={loadOptions}>Retry</button>
          </div>
        )}
        {groups.map((group) => {
          const maximum = group.selectionType === "single" ? Math.min(1, group.maxSelections) : group.maxSelections;
          const minimum = group.isRequired ? Math.max(1, group.minSelections) : group.minSelections;
          const selectedCount = selectedOptions[group.id]?.length ?? 0;
          return (
            <fieldset className={styles["modifier-group"]} key={group.id}>
              <legend>
                <span>{group.name}</span>
                <small>
                  {group.selectionType === "single"
                    ? (minimum > 0 ? "Choose one" : "Choose up to one")
                    : (minimum > 0 ? `Choose ${minimum}${maximum > minimum ? `–${maximum}` : ""}` : `Choose up to ${maximum}`)}
                  {group.isRequired && <b> Required</b>}
                </small>
              </legend>
              {group.options.map((option) => {
                const checked = selectedOptions[group.id]?.includes(option.id) ?? false;
                return (
                  <label className={styles["modifier-option"]} key={option.id}>
                    <input
                      type={group.selectionType === "single" ? "radio" : "checkbox"}
                      name={`modifier-${group.id}`}
                      checked={checked}
                      disabled={maximum === 0 || (!checked && selectedCount >= maximum)}
                      onChange={() => toggleOption(group.id, option.id, maximum)}
                    />
                    <span>{option.name}</span>
                    {option.priceAdjustment !== 0 && (
                      <strong>{option.priceAdjustment > 0 ? "+" : "−"}{formatMoney(Math.abs(option.priceAdjustment), currency)}</strong>
                    )}
                  </label>
                );
              })}
              {group.options.length === 0 && (
                <p className={styles["modifier-hint"]}>No options are currently available.</p>
              )}
              {minimum > 0 && selectedCount < minimum && (
                <p className={styles["modifier-hint"]}>Select at least {minimum} option{minimum === 1 ? "" : "s"}.</p>
              )}
            </fieldset>
          );
        })}
        <div className={`${styles["modal-footer"]}`}>
          <div className={`${styles["quantity"]}`}>
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
            >
              −
            </button>
            <span aria-live="polite">{quantity}</span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQuantity(quantity + 1)}
            >
              +
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-[5px]"
            disabled={optionsLoading || Boolean(optionsError) || Boolean(missingRequiredGroup || invalidGroup)}
            onClick={() => onAdd(quantity, groups.flatMap((group) =>
              group.options
                .filter((option) => selectedOptions[group.id]?.includes(option.id))
                .map((option) => ({
                  id: option.id,
                  name: option.name,
                  priceAdjustment: option.priceAdjustment,
                  groupName: group.name,
                })),
            ))}
          >
            Add to Order{selectedOptionCount > 0 ? ` · ${formatMoney(Math.max(0, item.price + selectedUpcharge), currency)} each` : ""}
          </Button>
        </div>
      </section>
    </div>
  );
}

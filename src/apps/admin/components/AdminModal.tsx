import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react"
import { createPortal } from "react-dom"
import styles from "../App.module.css"
import { Icon } from "@shared/ui/Icon"

/**
 * Accessible dialog primitive for the admin app.
 *
 * - `role="dialog"` / `aria-modal` / `aria-labelledby` on every dialog
 * - focus moves into the dialog on open and returns to the opener on close
 * - Tab / Shift+Tab cycle inside the dialog
 * - Escape and a backdrop press call `onClose`
 *
 * Callers own the dialog's visual content; this component owns behaviour.
 */
export type AdminModalProps = {
  /** id of the element that names the dialog. */
  labelledBy: string
  /** Optional id of the element that describes the dialog. */
  describedBy?: string
  role?: "dialog" | "alertdialog"
  onClose: () => void
  panelClassName?: string
  backdropClassName?: string
  /** Hide the built-in close button when the caller renders its own. */
  showClose?: boolean
  children: ReactNode
}

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",")

function getFocusable(panel: HTMLElement | null): HTMLElement[] {
  if (!panel) return []
  return Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector))
}

export function AdminModal({
  labelledBy,
  describedBy,
  role = "dialog",
  onClose,
  panelClassName,
  backdropClassName,
  showClose = true,
  children,
}: AdminModalProps) {
  const panelRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const first = getFocusable(panelRef.current)[0]
    first?.focus()

    return () => {
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      onCloseRef.current()
      return
    }

    if (event.key !== "Tab") return

    const items = getFocusable(panelRef.current)
    if (!items.length) {
      event.preventDefault()
      return
    }

    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement

    if (!panelRef.current?.contains(active)) {
      event.preventDefault()
      first.focus()
      return
    }

    if (event.shiftKey && active === first) {
      event.preventDefault()
      last.focus()
      return
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div
      className={[styles["modal-backdrop"], backdropClassName].filter(Boolean).join(" ")}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current()
      }}
    >
      <section
        ref={panelRef}
        className={[styles["modal"], panelClassName].filter(Boolean).join(" ")}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        onKeyDown={handleKeyDown}
      >
        {showClose && (
          <button
            type="button"
            className={styles["modal-close"]}
            onClick={onClose}
            aria-label="Close dialog"
          >
            <Icon name="close" />
          </button>
        )}
        {children}
      </section>
    </div>,
    document.body,
  )
}

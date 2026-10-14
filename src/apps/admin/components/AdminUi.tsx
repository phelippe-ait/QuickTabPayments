import type { ReactNode } from "react"
import styles from "../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { buttonVariants } from "@shared/ui/Button"
import type { Confirmation } from "../types"

export function SelectionBar({ count, children, onClear }: { count: number; children: ReactNode; onClear: () => void }) {
  return (
    <div className={`${styles["selection-bar"]}`}>
      <strong>{count} selected</strong>
      <div>{children}</div>
      <button type="button" onClick={onClear}>Clear selection</button>
    </div>
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className={`${styles["empty-state"]}`}>
      <span><Icon name="search" size={22} /></span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  )
}

export function ConfirmDialog({ confirmation, onClose }: { confirmation: Confirmation; onClose: () => void }) {
  return (
    <div className={`${styles["modal-backdrop"]} ${styles["confirmation-backdrop"]}`} onMouseDown={onClose}>
      <section className={`${styles["modal"]} ${styles["confirmation-modal"]}`} role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" onMouseDown={(event) => event.stopPropagation()}>
        <p className={`${styles["modal-kicker"]}`}>Please confirm</p>
        <h2 id="confirmation-title">{confirmation.title}</h2>
        <p className={`${styles["modal-description"]}`}>{confirmation.description}</p>
        <div className={`${styles["modal-actions"]}`}>
          <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={onClose}>Cancel</button>
          <button
            type="button"
            className={buttonVariants({ variant: "danger" })}
            onClick={() => {
              confirmation.onConfirm()
              onClose()
            }}
          >
            {confirmation.actionLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
export function PageHeader({ eyebrow, title, description, action, onAction }: { eyebrow: string; title: string; description: string; action?: string; onAction?: () => void }) {
  return <header className={`${styles["page-header"]}`}><div><p>{eyebrow}</p><h1>{title}</h1><span>{description}</span></div>{action && <button className={buttonVariants({ variant: "primary" })} onClick={onAction}><Icon name="plus" size={17} />{action}</button>}</header>
}

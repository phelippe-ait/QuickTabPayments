import type { ReactNode } from "react"
import { cn } from "@shared/lib/cn"
import styles from "../App.module.css"

type ResponsiveTableProps = {
  /** Accessible name for the scrollable region. */
  label: string
  className?: string
  children: ReactNode
}

/**
 * Horizontal-scroll wrapper for the wide admin tables.
 *
 * The admin tables keep their desktop grid layout; below the tablet breakpoint
 * their columns get a minimum width and this wrapper lets the user pan sideways
 * instead of squeezing or clipping cells. The wrapper is focusable so keyboard
 * users can scroll it (WCAG 2.1.1), and the label gives the region a name.
 */
export function ResponsiveTable({
  label,
  className,
  children,
}: ResponsiveTableProps) {
  return (
    <div
      className={cn(styles["responsive-table"], className)}
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      {children}
    </div>
  )
}

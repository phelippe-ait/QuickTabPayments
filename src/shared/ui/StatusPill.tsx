import type { ReactNode } from "react";
import { cn } from "@shared/lib/cn";

/**
 * Status tones shared across the product.
 *
 * `occupied`/`available` describe a table's seating state; the rest mirror the
 * kitchen / order lifecycle. Colours come from design tokens, so a restaurant
 * theme only needs to override the tokens.
 */
export type StatusTone =
  | "occupied"
  | "available"
  | "new"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

const toneClasses: Record<StatusTone, string> = {
  occupied: "bg-berry-soft text-berry-strong",
  available: "bg-sage-soft text-sage-strong",
  new: "bg-neutral-soft text-neutral",
  preparing: "bg-amber-soft text-amber",
  ready: "bg-sage-soft text-sage-strong",
  completed: "bg-info-soft text-info",
  cancelled: "bg-danger-soft text-danger",
};

export type StatusPillProps = {
  tone: StatusTone;
  children: ReactNode;
  withDot?: boolean;
  className?: string;
};

export function StatusPill({ tone, children, withDot = true, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em]",
        toneClasses[tone],
        className,
      )}
    >
      {withDot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

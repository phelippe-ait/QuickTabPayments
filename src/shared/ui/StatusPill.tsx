import type { ReactNode } from "react";
import { cn } from "@shared/lib/cn";

/**
 * Colour-semantic status tones shared across the product.
 *
 * Tones describe *meaning by colour*, not a specific workflow, so one set
 * serves every domain: e.g. `success` = completed/available/ready, `primary` =
 * brand accent, `danger` = cancelled/unavailable.
 */
export type StatusTone = "primary" | "success" | "warning" | "info" | "danger" | "neutral";

const toneClasses: Record<StatusTone, string> = {
  primary: "bg-berry-soft text-berry-strong",
  success: "bg-sage-soft text-sage-strong",
  warning: "bg-amber-soft text-amber",
  info: "bg-info-soft text-info",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-neutral-soft text-neutral",
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

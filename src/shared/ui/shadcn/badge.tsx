/* eslint-disable react-refresh/only-export-components -- shadcn/ui exposes the variant recipe alongside the component */
import type { HTMLAttributes } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@shared/lib/cn"

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em]",
  {
    variants: {
      variant: {
        default: "bg-berry-soft text-berry-strong",
        success: "bg-sage-soft text-sage-strong",
        warning: "bg-amber-soft text-amber",
        info: "bg-info-soft text-info",
        danger: "bg-danger-soft text-danger",
        neutral: "bg-neutral-soft text-neutral",
      },
    },
    defaultVariants: { variant: "default" },
  },
)

export type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

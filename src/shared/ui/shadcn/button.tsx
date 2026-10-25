/* eslint-disable react-refresh/only-export-components -- shadcn/ui exposes the variant recipe alongside the component */
import type { ButtonHTMLAttributes } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@shared/lib/cn"

/**
 * shadcn/ui button recipe used by net-new Phase 5 components (tracking,
 * confirmation, badges). The hand-rolled `@shared/ui/Button` remains for the
 * existing screens so this does not restyle the admin or customer apps.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[9px] text-[13px] font-bold transition disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-berry",
  {
    variants: {
      variant: {
        default:
          "bg-berry-deep text-white shadow-[0_7px_16px_rgba(163,55,76,0.22)] hover:bg-berry-dark",
        outline:
          "border border-berry-deep bg-transparent text-berry-deep hover:bg-berry-soft",
        secondary:
          "border border-line bg-white text-ink-mid hover:border-placeholder",
        ghost: "bg-transparent text-ink-mid hover:bg-cream",
        destructive: "bg-berry-deep text-white hover:bg-berry-dark",
      },
      size: {
        default: "min-h-[42px] px-[17px]",
        sm: "min-h-9 px-3 text-[11px]",
        lg: "min-h-[46px] px-5",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
)

export type ShadcnButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ShadcnButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

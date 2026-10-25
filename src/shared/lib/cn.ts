import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export type { ClassValue };

/**
 * Class-name composition for both Tailwind utilities and CSS-module values.
 *
 * `clsx` handles conditionals; `tailwind-merge` resolves conflicting utilities
 * (e.g. `px-2` + `px-4` → `px-4`), which is the shadcn/ui convention used by
 * the net-new Phase 5 components. CSS-module class strings pass through
 * unchanged.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

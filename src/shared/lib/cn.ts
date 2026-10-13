export type ClassValue = string | number | null | false | undefined;

/**
 * Joins truthy class names with a single space.
 *
 * Works for both Tailwind utility strings and CSS-module class values:
 *   cn("flex", "gap-2")                 // Tailwind strings
 *   cn(styles.card, isActive && styles.active)  // CSS module + conditional
 *
 * Deliberately dependency-free — swap for `clsx` + `tailwind-merge` once
 * class-conflict resolution is needed.
 */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}

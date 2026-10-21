/* eslint-disable react-refresh/only-export-components -- Button + its variant recipe intentionally share one file */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@shared/lib/cn";

/**
 * Shared button styles for the whole product.
 *
 * `buttonVariants` returns the class string (useful when adopting an existing
 * `<button className=...>` with minimal churn); `Button` is the component for
 * new code. Both share one recipe, so the two never drift.
 */
export type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[9px] font-bold transition disabled:cursor-not-allowed disabled:opacity-45 disabled:transform-none";

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-[11px]",
  md: "min-h-[42px] px-[17px] text-[13px]",
  lg: "min-h-[43px] px-4 text-[13px]",
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-0 bg-berry-strong text-white shadow-[0_7px_16px_rgba(184,64,87,0.2)] hover:bg-berry-deep hover:-translate-y-px",
  secondary: "border border-line bg-white text-ink-mid hover:border-placeholder",
  outline: "border border-berry-strong bg-transparent text-berry-strong hover:bg-berry-soft",
  danger: "border-0 bg-berry-strong text-white hover:bg-berry-deep",
  ghost: "border-0 bg-transparent text-ink-mid hover:bg-cream",
};

export type ButtonVariantOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  fullWidth = false,
}: ButtonVariantOptions = {}): string {
  return cn(base, sizes[size], variants[variant], fullWidth && "w-full");
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonVariantOptions & {
    children?: ReactNode;
  };

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...rest}
    />
  );
}

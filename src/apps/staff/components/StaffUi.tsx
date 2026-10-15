import styles from "../App.module.css"
import { Icon, type IconName } from "@shared/ui/Icon"

export function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active?: boolean
  icon: IconName
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={`${styles["nav-button"]} w-full ${
        active ? "bg-cream-2 text-berry-strong" : ""
      }`}
      onClick={onClick}
    >
      <Icon name={icon} />
      {label}
      {active && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-berry" />
      )}
    </button>
  )
}

export function MobileNav({
  active,
  icon,
  label,
  onClick,
}: {
  active?: boolean
  icon: IconName
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={`flex min-w-20 flex-col items-center gap-1 text-[10px] font-bold ${
        active ? "text-berry" : "text-muted"
      }`}
      onClick={onClick}
    >
      <Icon name={icon} size={20} />
      {label}
    </button>
  )
}

export function Stat({
  value,
  label,
  tone,
}: {
  value: string
  label: string
  tone: "rose" | "green"
}) {
  return (
    <div className="min-w-28 rounded-2xl border border-line bg-paper px-4 py-3">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            tone === "rose" ? "bg-berry" : "bg-sage"
          }`}
        />
        <strong className="font-serif text-2xl font-normal">{value}</strong>
      </div>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.13em] text-muted">
        {label}
      </p>
    </div>
  )
}

import type { ReactNode } from "react"
import styles from "../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { MobileNav, NavButton } from "./StaffUi"
import type { View } from "../types"

type StaffShellProps = {
  view: View
  onViewChange: (view: View) => void
  children: ReactNode
  overlays?: ReactNode
}

export function StaffShell({ view, onViewChange, children, overlays }: StaffShellProps) {
  return (
    <div className="min-h-screen bg-cream-2 text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-line bg-paper px-5 py-7 lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-berry font-serif text-xl text-white">S</div>
          <div><p className="font-serif text-[21px] leading-5">Café Shop</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Dining room</p></div>
        </div>
        <nav className="mt-12 space-y-1.5">
          <NavButton active={view === "tables"} icon="grid" label="Table overview" onClick={() => onViewChange("tables")} />
          <NavButton active={view === "kitchen"} icon="kitchen" label="Kitchen" onClick={() => onViewChange("kitchen")} />
          <NavButton active={view === "history"} icon="receipt" label="Order history" onClick={() => onViewChange("history")} />
          <NavButton active={view === "reservations"} icon="calendar" label="Reservations" onClick={() => onViewChange("reservations")} />
        </nav>
        <div className="mt-auto">
          <button className={`${styles["nav-button"]} mb-5 w-full`}><Icon name="settings" />Settings</button>
          <div className="border-t border-line-soft pt-5"><div className="flex items-center gap-3 rounded-2xl bg-cream-2 p-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#413a30] text-xs font-bold text-white">AM</div>
            <div className="min-w-0"><p className="truncate text-sm font-bold">Alex Morgan</p><p className="text-xs text-muted">Floor manager</p></div>
          </div></div>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-line bg-paper/95 px-5 backdrop-blur md:px-8">
          <div className="flex items-center gap-3 lg:hidden"><div className="grid h-9 w-9 place-items-center rounded-xl bg-berry font-serif text-lg text-white">S</div><span className="font-serif text-lg">Café Shop</span></div>
          <div className="hidden lg:block"><p className="text-sm font-bold">Friday, May 24</p><p className="mt-0.5 text-xs text-muted">Dinner service · 5:00 PM – 11:00 PM</p></div>
          <div className="flex items-center gap-3"><div className="hidden items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-xs font-bold text-ink-soft sm:flex"><span className="h-2 w-2 rounded-full bg-sage" />Service live</div>
            <button aria-label="Notifications" className="relative grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-ink-soft transition hover:border-berry hover:text-berry"><Icon name="bell" size={19} /><span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-berry" /></button>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] px-5 py-7 md:px-8 md:py-10">{children}</main>
        <footer className={styles["technology-footer"]}>Developed by QuickTab Payments Team</footer>
        <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-line bg-paper lg:hidden">
          <MobileNav active={view === "tables"} icon="grid" label="Tables" onClick={() => onViewChange("tables")} />
          <MobileNav active={view === "kitchen"} icon="kitchen" label="Kitchen" onClick={() => onViewChange("kitchen")} />
          <MobileNav active={view === "history"} icon="receipt" label="History" onClick={() => onViewChange("history")} />
          <MobileNav active={view === "reservations"} icon="calendar" label="Bookings" onClick={() => onViewChange("reservations")} />
        </nav>
      </div>
      {overlays}
    </div>
  )
}

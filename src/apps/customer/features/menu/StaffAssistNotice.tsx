import { useState } from "react"
import { Icon } from "@shared/ui/Icon"
import {
  CUSTOMER_STAFF_ASSIST_NOTICE,
  STAFF_ASSIST_DISMISSED_KEY,
} from "../../constants"

function readDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(STAFF_ASSIST_DISMISSED_KEY) === "1"
  } catch {
    return false
  }
}

function rememberDismissed(): void {
  try {
    window.sessionStorage.setItem(STAFF_ASSIST_DISMISSED_KEY, "1")
  } catch {
    // Storage can fail in private mode; the notice still hides for this view.
  }
}

/**
 * Non-blocking note for guests who would rather have a staff member take their
 * order. Dismissible for the rest of the session so it never gets in the way.
 */
export function StaffAssistNotice() {
  const [dismissed, setDismissed] = useState(readDismissed)

  if (dismissed) return null

  return (
    <aside
      className="mb-5 flex items-start gap-2 rounded-lg border border-line-2 bg-cream-3 px-3 py-2.5"
      aria-label="Ordering with a staff member"
    >
      <span className="mt-0.5 shrink-0 text-berry" aria-hidden="true">
        <Icon name="coffee" size={16} />
      </span>
      <p className="flex-1 text-[11px] leading-relaxed text-ink-mid">
        {CUSTOMER_STAFF_ASSIST_NOTICE}
      </p>
      <button
        type="button"
        aria-label="Dismiss staff ordering note"
        title="Dismiss"
        className="-my-2 -mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-cream-2 hover:text-berry"
        onClick={() => {
          setDismissed(true)
          rememberDismissed()
        }}
      >
        <Icon name="close" size={15} />
      </button>
    </aside>
  )
}

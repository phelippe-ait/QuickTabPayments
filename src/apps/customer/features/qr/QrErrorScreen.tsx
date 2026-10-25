import { Icon } from "@shared/ui/Icon"
import { Button } from "@shared/ui/Button"
import { qrErrorMessage, type QrErrorCode } from "../../types"

/**
 * Boot-time QR failure. Every branch is intentionally explicit so a customer
 * knows whether to rescan, ask staff, or retry.
 */
export function QrErrorScreen({
  error,
  onRetry,
}: {
  error: QrErrorCode
  onRetry: () => void
}) {
  const canRetry = error === "unknown"
  const title =
    error === "missing_params" || error === "no_context"
      ? "Scan the QR code on your table"
      : error === "table_inactive"
        ? "This table is closed"
        : "We couldn't open this menu"

  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-6 py-12">
      <section
        role="alert"
        className="w-full max-w-md rounded-card border border-line bg-paper p-8 text-center shadow-card"
      >
        <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-berry-soft text-berry">
          <Icon name="receipt" size={26} />
        </span>
        <h1 className="font-serif text-2xl text-ink">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-mid">
          {qrErrorMessage(error)}
        </p>
        {canRetry && (
          <Button variant="outline" className="mt-6 w-full" onClick={onRetry}>
            Try again
          </Button>
        )}
        {!canRetry && (
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-2">
            QuickTab · scan to order
          </p>
        )}
      </section>
    </main>
  )
}

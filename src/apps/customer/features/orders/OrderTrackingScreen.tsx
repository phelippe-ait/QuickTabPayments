import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router"
import { useAuth } from "@shared/auth/AuthContext"
import { supabase } from "@shared/lib/supabase"
import { cn } from "@shared/lib/cn"
import { formatMoney } from "@shared/lib/money"
import { orderStatusLabels, orderStatusTones } from "@shared/orders/status"
import type { OrderStatus } from "@shared/lib/database.types"
import { Badge, type BadgeProps } from "@shared/ui/shadcn/badge"
import { buttonVariants } from "@shared/ui/shadcn/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/ui/shadcn/card"
import { Separator } from "@shared/ui/shadcn/separator"
import { Skeleton } from "@shared/ui/shadcn/skeleton"
import {
  fetchOrderTracking,
  isTerminalStatus,
  TRACKING_POLL_INTERVAL_MS,
  type TrackingOrder,
} from "../../data/tracking"

const STEPS: Array<{ status: OrderStatus; label: string; description: string }> = [
  { status: "pending", label: "Order placed", description: "We received your order." },
  { status: "confirmed", label: "Confirmed", description: "Your order was sent to the kitchen." },
  { status: "preparing", label: "Preparing", description: "The kitchen is making your order." },
  { status: "ready", label: "Ready", description: "Ready to collect from the counter." },
  { status: "completed", label: "Completed", description: "Collected. Enjoy!" },
]

function badgeVariant(status: OrderStatus): BadgeProps["variant"] {
  const tone = orderStatusTones[status]
  return tone === "primary" ? "default" : tone
}

type TrackingState = {
  phase: "loading" | "ready" | "notfound" | "error"
  order: TrackingOrder | null
  error: string
  refreshing: boolean
}

function useTracking(token: string) {
  const [state, setState] = useState<TrackingState>({
    phase: "loading",
    order: null,
    error: "",
    refreshing: false,
  })
  const terminalRef = useRef(false)

  const refresh = useCallback(async () => {
    if (!token.trim()) {
      terminalRef.current = true
      setState({ phase: "notfound", order: null, error: "", refreshing: false })
      return
    }
    setState((current) => ({
      ...current,
      phase: current.order ? current.phase : "loading",
      refreshing: true,
    }))
    try {
      const order = await fetchOrderTracking(token)
      terminalRef.current = order ? isTerminalStatus(order.status) : true
      setState({
        phase: order ? "ready" : "notfound",
        order,
        error: "",
        refreshing: false,
      })
    } catch (error) {
      setState((current) =>
        current.order
          ? { ...current, refreshing: false }
          : {
              phase: "error",
              order: null,
              error:
                error instanceof Error
                  ? error.message
                  : "Could not load this order.",
              refreshing: false,
            },
      )
    }
  }, [token])

  // Guests are RLS-filtered out of Realtime, so polling is the shared
  // mechanism. It stops as soon as the order reaches a terminal status.
  useEffect(() => {
    let cancelled = false
    let timer: number | undefined

    terminalRef.current = false
    const tick = async () => {
      await refresh()
      if (!cancelled && !terminalRef.current) {
        timer = window.setTimeout(tick, TRACKING_POLL_INTERVAL_MS)
      }
    }
    void tick()

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [refresh])

  return { ...state, refresh }
}

export function OrderTrackingScreen() {
  const { orderNumber = "" } = useParams()
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const { user } = useAuth()
  const tracking = useTracking(token)
  const { order, refresh } = tracking

  // Signed-in owners/staff may receive Realtime updates; polling is the
  // fallback for them and the primary mechanism for guests.
  useEffect(() => {
    if (!supabase || !user || !order?.orderId) return
    const channel = supabase
      .channel(`order-tracking-${order.orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${order.orderId}`,
        },
        () => {
          void refresh()
        },
      )
      .subscribe()

    return () => {
      void supabase?.removeChannel(channel)
    }
  }, [user, order?.orderId, refresh])

  const eta = order?.pickupTimeEstimate
    ? new Date(order.pickupTimeEstimate)
    : null
  const etaLabel =
    eta && !Number.isNaN(eta.getTime())
      ? new Intl.DateTimeFormat(undefined, {
          hour: "numeric",
          minute: "2-digit",
        }).format(eta)
      : null

  const currentIndex = order
    ? STEPS.findIndex((step) => step.status === order.status)
    : -1

  return (
    <main className="min-h-dvh bg-cream px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <h1 className="sr-only">
          Order tracking for {orderNumber || "this order"}
        </h1>
        <header className="flex items-center justify-between">
          <Link
            to="/"
            className="text-[11px] font-bold uppercase tracking-[0.12em] text-berry-deep hover:underline"
          >
            ← Back to menu
          </Link>
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            Order tracking
          </span>
        </header>

        {tracking.phase === "loading" && (
          <Card aria-label="Loading order">
            <CardHeader>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-40" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        )}

        {tracking.phase === "notfound" && (
          <Card role="alert">
            <CardHeader>
              <CardTitle>Order not found</CardTitle>
              <CardDescription>
                This tracking link is invalid or has expired. Please check the
                link, or ask a team member for help.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/" className={buttonVariants({ variant: "outline", className: "w-full" })}>
                Back to menu
              </Link>
            </CardContent>
          </Card>
        )}

        {tracking.phase === "error" && (
          <Card role="alert">
            <CardHeader>
              <CardTitle>We couldn&apos;t load this order</CardTitle>
              <CardDescription>{tracking.error}</CardDescription>
            </CardHeader>
            <CardContent>
              <button
                type="button"
                className={buttonVariants({ variant: "outline", className: "w-full" })}
                onClick={() => void refresh()}
              >
                Try again
              </button>
            </CardContent>
          </Card>
        )}

        {tracking.phase === "ready" && order && (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-[0.16em]">
                      {order.restaurantName || "Your order"}
                    </CardDescription>
                    <CardTitle className="mt-1 text-3xl text-berry">
                      {order.orderNumber || orderNumber}
                    </CardTitle>
                  </div>
                  <Badge variant={badgeVariant(order.status)}>
                    {orderStatusLabels[order.status]}
                  </Badge>
                </div>
                <p className="mt-1 text-[12px] text-ink-mid" aria-live="polite">
                  {order.status === "cancelled"
                    ? "This order was cancelled. Please speak to a team member if you need help."
                    : order.status === "completed"
                      ? "This order is complete. Thanks for visiting!"
                      : "This page updates automatically — you can leave it open."}
                </p>
                {order.tableNumber && (
                  <p className="text-[12px] text-ink-mid">
                    Table {order.tableNumber}
                  </p>
                )}
                {etaLabel && order.status !== "completed" && order.status !== "cancelled" && (
                  <p className="text-[12px] text-ink-mid">
                    Estimated ready around <strong>{etaLabel}</strong>
                  </p>
                )}
              </CardHeader>

              <CardContent>
                {order.status === "cancelled" ? (
                  <p className="rounded-lg bg-danger-soft p-4 text-[12px] text-danger">
                    Your order was cancelled and will not be prepared.
                  </p>
                ) : (
                  <ol className="flex flex-col">
                    {STEPS.map((step, index) => {
                      const complete = currentIndex > index
                      const current = currentIndex === index
                      return (
                        <li
                          key={step.status}
                          className="relative flex gap-3 pb-5 last:pb-0"
                        >
                          {index < STEPS.length - 1 && (
                            <span
                              aria-hidden="true"
                              className={cn(
                                "absolute left-[8px] top-5 h-full w-px",
                                complete ? "bg-berry" : "bg-line",
                              )}
                            />
                          )}
                          <span
                            aria-hidden="true"
                            className={cn(
                              "relative z-[1] mt-1 h-[17px] w-[17px] flex-none rounded-full border-2",
                              complete || current
                                ? "border-berry bg-berry"
                                : "border-line bg-paper",
                              current && "ring-4 ring-berry-soft",
                            )}
                          />
                          <div className="min-w-0">
                            <strong
                              className={cn(
                                "block text-[12px]",
                                complete || current
                                  ? "text-ink"
                                  : "text-muted",
                              )}
                            >
                              {step.label}
                            </strong>
                            <p className="text-[11px] text-ink-mid">
                              {current ? step.description : ""}
                            </p>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                )}

                <Separator className="my-5" />

                <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                  Items
                </h3>
                <ul className="flex flex-col gap-2 text-[12px] text-ink-mid">
                  {order.items.map((item, index) => (
                    <li key={`${item.name}-${index}`} className="flex justify-between gap-3">
                      <span>
                        {item.quantity} × {item.name}
                      </span>
                      <span>{formatMoney(item.subtotal, order.currency)}</span>
                    </li>
                  ))}
                  {order.items.length === 0 && (
                    <li>Item details are unavailable.</li>
                  )}
                </ul>

                <dl className="mt-4 flex flex-col gap-2 border-t border-line-soft pt-3 text-[12px] text-ink-mid">
                  <div className="flex justify-between">
                    <dt>Subtotal</dt>
                    <dd>{formatMoney(order.subtotal, order.currency)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>GST (included)</dt>
                    <dd>{formatMoney(order.tax, order.currency)}</dd>
                  </div>
                  <div className="flex justify-between text-[14px] font-bold text-ink">
                    <dt>Total</dt>
                    <dd>{formatMoney(order.total, order.currency)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </>
        )}

        <p className="text-center text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
          QuickTab · scan, order, track
        </p>
      </div>
    </main>
  )
}

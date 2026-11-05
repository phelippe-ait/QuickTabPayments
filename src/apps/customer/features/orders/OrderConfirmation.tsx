import { Link } from "react-router"
import styles from "../../App.module.css"
import { Button } from "@shared/ui/Button"
import {
  Badge,
  type BadgeProps,
} from "@shared/ui/shadcn/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/ui/shadcn/card"
import { Separator } from "@shared/ui/shadcn/separator"
import { buttonVariants } from "@shared/ui/shadcn/button"
import { formatMoney, inclusiveTaxLabel } from "@shared/lib/money"
import { orderStatusLabels, orderStatusTones } from "@shared/orders/status"
import { paymentStatusLabels } from "@shared/orders/paymentLabels"
import { Icon } from "@shared/ui/Icon"
import type { OrderStatus } from "@shared/lib/database.types"
import { HeaderButton } from "../../components/CustomerUi"
import { trackingUrl } from "../../data/tracking"
import type { PlacedOrder } from "../../data/placeOrder"

function statusBadgeVariant(status: OrderStatus): BadgeProps["variant"] {
  const tone = orderStatusTones[status]
  return tone === "primary" ? "default" : tone
}

export function OrderConfirmation({
  order,
  isLoggedIn,
  onClose,
  onLogin,
  onSignup,
}: {
  order: PlacedOrder | null;
  isLoggedIn: boolean;
  onClose: () => void;
  onLogin: () => void;
  onSignup: () => void;
}) {
  if (!order) {
    return (
      <main className={`${styles["page-screen"]} ${styles["confirmation"]}`}>
        <header className={`${styles["confirmation-header"]}`}>
          <span>Order Confirmation</span>
          <HeaderButton
            icon="close"
            label="Close confirmation"
            onClick={onClose}
          />
        </header>
        <section className={`${styles["confirmation-error"]}`} role="alert">
          <h2>We couldn&apos;t find that order</h2>
          <p>Please ask a team member for help or place your order again.</p>
          <Button variant="outline" className="w-auto px-6" onClick={onClose}>
            Back to menu
          </Button>
        </section>
      </main>
    )
  }

  const trackHref = trackingUrl(order.orderNumber, order.trackingToken)
  const paymentStatus = order.paymentStatus ?? "pending"
  const paymentLabel = paymentStatusLabels[paymentStatus]

  return (
    <main className={`${styles["page-screen"]} ${styles["confirmation"]}`}>
      <h1 className="sr-only">Order confirmation</h1>
      <header className={`${styles["confirmation-header"]}`}>
        <span>Order Confirmation</span>
        <HeaderButton
          icon="close"
          label="Close confirmation"
          onClick={onClose}
        />
      </header>

      <div className="mx-auto mt-5 w-full max-w-lg">
        <Card>
          <CardHeader className="text-center">
            <span className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-sage-soft text-sage-strong">
              <Icon name="check" size={20} />
            </span>
            <CardTitle>
              Thanks{order.customerName ? `, ${order.customerName}` : ""}!
            </CardTitle>
            <CardDescription>
              Your order is with the kitchen. Keep this page or track it live.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-2 border-y border-line-soft py-5">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                Order number
              </span>
              <strong className="font-serif text-3xl text-berry">
                {order.orderNumber}
              </strong>
              <Badge variant={statusBadgeVariant(order.status)}>
                {orderStatusLabels[order.status]}
              </Badge>
              {order.tableNumber && (
                <span className="text-[12px] text-ink-mid">
                  Table {order.tableNumber}
                </span>
              )}
            </div>

            <ul className="mt-5 flex flex-col gap-2 text-[12px] text-ink-mid">
              {order.items.map((item, index) => (
                <li key={`${item.name}-${index}`} className="flex justify-between gap-3">
                  <span>
                    {item.quantity} × {item.name}
                    {(item.modifiers?.length ?? 0) > 0 && (
                      <small className="mt-1 block text-[10px] text-muted">
                        {item.modifiers?.map((modifier) => modifier.name).join(", ")}
                      </small>
                    )}
                  </span>
                  <span>{formatMoney(item.subtotal, order.currency)}</span>
                </li>
              ))}
            </ul>

            <Separator className="my-4" />

            <dl className="flex flex-col gap-2 text-[12px] text-ink-mid">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd>{formatMoney(order.subtotal, order.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{inclusiveTaxLabel(order.taxRate ?? 0)}</dt>
                <dd>{formatMoney(order.tax, order.currency)}</dd>
              </div>
              <div className="flex justify-between text-[14px] font-bold text-ink">
                <dt>Total</dt>
                <dd>{formatMoney(order.total, order.currency)}</dd>
              </div>
            </dl>

            <div className="mt-3 rounded-lg bg-sage-soft p-3 text-center text-[12px] text-sage-strong">
              <strong>
                {paymentStatus === "succeeded"
                  ? "Payment received"
                  : paymentStatus === "failed"
                    ? "Payment failed"
                    : paymentStatus === "refunded"
                      ? "Payment refunded"
                      : "Payment confirming"}
              </strong>
              <span className="mt-0.5 block text-[10px] font-normal">
                {paymentLabel}
              </span>
              {order.receiptUrl && (
                <a
                  className="mt-1 inline-block text-[11px] font-bold underline"
                  href={order.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  View receipt
                </a>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <Link
                to={trackHref}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ className: "w-full" })}
              >
                Track order
              </Link>
              <Button variant="secondary" fullWidth onClick={onClose}>
                Back to menu
              </Button>
            </div>
          </CardContent>
        </Card>

        {!isLoggedIn && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">Save your details</CardTitle>
              <CardDescription>
                Create an account or log in to make your next order faster.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                fullWidth
                className="text-[10px]"
                onClick={onSignup}
              >
                Create account
              </Button>
              <Button
                variant="secondary"
                fullWidth
                className="text-[10px]"
                onClick={onLogin}
              >
                Log in
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}

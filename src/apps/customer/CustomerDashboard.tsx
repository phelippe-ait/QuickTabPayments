import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import styles from "./App.module.css"
import { useAuth } from "@shared/auth/AuthContext"
import { AUTH_RETURN_KEY } from "./constants"
import { useCart } from "./hooks/useCart"
import { QrProvider, useQrContext } from "./features/qr/QrProvider"
import { QrErrorScreen } from "./features/qr/QrErrorScreen"
import { MenuScreen } from "./features/menu/MenuScreen"
import { ProductModal } from "./features/menu/ProductModal"
import { CartScreen } from "./features/cart/CartScreen"
import { OrderConfirmation } from "./features/orders/OrderConfirmation"
import { OrdersScreen } from "./features/orders/OrdersScreen"
import { AuthScreen } from "./features/auth/AuthScreen"
import type { MenuItem, QrContext, Screen } from "./types"
import type { PlacedOrder } from "./data/placeOrder"
import { PaymentSetupError } from "./data/payments"
import { splitInclusiveTax, roundMoney } from "@shared/lib/money"
import { fetchMenu } from "./data/menuApi"
import { claimGuestOrder } from "./data/orders"
import { clearLastOrder, readLastOrder, saveLastOrder } from "./data/lastOrder"
import { requestCustomerLocation } from "./data/geolocation"

// Checkout (and with it the Stripe SDK) is only fetched once the customer
// reaches the payment step, keeping it out of the menu's initial chunk.
const CheckoutScreen = lazy(() =>
  import("./features/checkout/CheckoutScreen").then((module) => ({
    default: module.CheckoutScreen,
  })),
)

export default function App() {
  return (
    <QrProvider>
      <CustomerShell />
    </QrProvider>
  )
}

function CustomerShell() {
  const { user, profile } = useAuth()
  const qrState = useQrContext()
  const context = qrState.context
  const queryClient = useQueryClient()

  const source = useMemo(
    () =>
      context
        ? {
            slug: context.restaurantSlug,
            tableToken: context.tableToken,
          }
        : null,
    [context],
  )
  const cart = useCart(source)

  const [screen, setScreen] = useState<Screen>("menu")
  const [selected, setSelected] = useState<MenuItem | null>(null)
  const [createdOrder, setCreatedOrder] = useState<PlacedOrder | null>(null)
  const [checkoutError, setCheckoutError] = useState("")
  const [cartAnnouncement, setCartAnnouncement] = useState("")
  const [authReturnScreen, setAuthReturnScreen] =
    useState<"menu" | "confirmation">("menu")
  const restoredLastOrder = useRef(false)
  const claimedOrder = useRef<string | null>(null)
  const cartTriggerRef = useRef<HTMLButtonElement | null>(null)
  const restoreCartFocus = useRef(false)

  // The menu unmounts while the cart is open, so its trigger is a fresh node
  // when we return. Restore focus to it after the menu is back on screen.
  useEffect(() => {
    if (screen !== "menu" || !restoreCartFocus.current) return
    restoreCartFocus.current = false
    cartTriggerRef.current?.focus()
  }, [screen])

  // A reload (or an OAuth redirect) restores the confirmation screen for the
  // guest's last order at this table.
  useEffect(() => {
    if (qrState.status !== "ready" || !context || !source) return
    if (restoredLastOrder.current) return
    restoredLastOrder.current = true
    const stored = readLastOrder(source)
    if (stored) {
      setCreatedOrder(stored)
      setScreen("confirmation")
    }
  }, [context, qrState.status, source])

  const openAuth = (
    authScreen: "login" | "signup",
    returnTo: "menu" | "confirmation",
  ) => {
    setAuthReturnScreen(returnTo)
    // Persisted so we can return here after an OAuth redirect reloads the page.
    window.sessionStorage.setItem(AUTH_RETURN_KEY, returnTo)
    setScreen(authScreen)
  }

  const closeAuth = () => {
    window.sessionStorage.removeItem(AUTH_RETURN_KEY)
    setScreen(authReturnScreen)
  }

  // After an OAuth redirect the page reloads with a session; return to the
  // screen where auth began.
  useEffect(() => {
    if (!user) return
    const pending = window.sessionStorage.getItem(AUTH_RETURN_KEY)
    if (!pending) return
    window.sessionStorage.removeItem(AUTH_RETURN_KEY)
    setScreen(pending === "confirmation" ? "confirmation" : "menu")
  }, [user])

  // Signing out while viewing order history would otherwise leave a blank
  // shell; return to the menu instead.
  useEffect(() => {
    if (!user && screen === "orders") setScreen("menu")
  }, [screen, user])

  // A guest who signs in from the confirmation screen gets the order attached
  // to their account, so it appears in order history.
  useEffect(() => {
    if (!user || !createdOrder) return
    const key = `${user.id}:${createdOrder.orderId}`
    if (claimedOrder.current === key) return
    claimedOrder.current = key
    void claimGuestOrder(createdOrder.trackingToken)
  }, [createdOrder, user])

  const profileName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    user?.email?.split("@")[0] ||
    ""

  if (qrState.status === "loading") {
    return (
      <div className={styles["app-shell"]}>
        <main className="flex min-h-dvh items-center justify-center bg-cream px-5">
          <div className="w-full max-w-md space-y-3" role="status" aria-label="Opening the menu">
            <div className="mx-auto h-8 w-48 animate-pulse rounded-lg bg-line-soft" />
            <div className="h-40 w-full animate-pulse rounded-card bg-line-soft" />
            <div className="h-12 w-full animate-pulse rounded-lg bg-line-soft" />
            <div className="h-28 w-full animate-pulse rounded-lg bg-line-soft" />
            <span className="sr-only">Opening the menu…</span>
          </div>
        </main>
      </div>
    )
  }

  if (qrState.status === "error" || !context) {
    return (
      <QrErrorScreen
        error={qrState.error ?? "unknown"}
        onRetry={qrState.retry}
      />
    )
  }

  const currentContext: QrContext = context

  const closeConfirmation = () => {
    if (source) clearLastOrder(source)
    setCreatedOrder(null)
    setCheckoutError("")
    setScreen("menu")
  }

  const closeCart = () => {
    restoreCartFocus.current = true
    setScreen("menu")
  }

  return (
    <div
      className={`${styles["app-shell"]} ${screen === "menu" ? styles["with-sidebar"] : ""}`}
    >
      {screen === "menu" && (
        <MenuScreen
          qr={currentContext}
          cartCount={cart.count}
          total={cart.total}
          onOpenCart={() => setScreen("cart")}
          onOpenOrders={() => setScreen("orders")}
          onSelect={setSelected}
          onAuth={(authScreen) => openAuth(authScreen, "menu")}
          onReconcile={cart.reconcile}
          cartTriggerRef={cartTriggerRef}
        />
      )}
      {screen === "cart" && (
        <CartScreen
          items={cart.items}
          total={cart.total}
          currency={currentContext.currency}
          onClose={closeCart}
          onRemove={cart.remove}
          onDecrease={cart.decrease}
          onIncrease={cart.increase}
          onCheckout={() => {
            setCheckoutError("")
            setScreen("checkout")
          }}
        />
      )}
      {screen === "checkout" && (
        <Suspense
          fallback={
            <div className="flex min-h-dvh items-center justify-center bg-cream px-5">
              <div
                className="w-full max-w-md space-y-3"
                role="status"
                aria-label="Loading checkout"
              >
                <div className="mx-auto h-8 w-48 animate-pulse rounded-lg bg-line-soft" />
                <div className="h-40 w-full animate-pulse rounded-card bg-line-soft" />
                <div className="h-12 w-full animate-pulse rounded-lg bg-line-soft" />
                <span className="sr-only">Loading checkout…</span>
              </div>
            </div>
          }
        >
          <CheckoutScreen
            items={cart.items}
            currency={currentContext.currency}
            taxRate={currentContext.taxRate}
            restaurantName={currentContext.restaurantName}
            restaurantSlug={currentContext.restaurantSlug}
            tableToken={currentContext.tableToken}
            tableNumber={currentContext.tableNumber}
            canCheckout={cart.canCheckout}
            defaultName={profileName}
            onClose={() => {
              setCheckoutError("")
              setScreen("cart")
            }}
            error={checkoutError}
            onRequestLocation={
              currentContext.geofenceEnabled ? requestCustomerLocation : undefined
            }
            onSetupError={async (setupError) => {
              if (
                setupError instanceof PaymentSetupError &&
                setupError.code === "menu_item_unavailable"
              ) {
                // The menu changed mid-session: refresh it and drop sold-out lines.
                const menu = await fetchMenu(currentContext.restaurantId).catch(
                  () => null,
                )
                if (menu)
                  cart.reconcile(menu.flatMap((category) => category.items))
                void queryClient.invalidateQueries({
                  queryKey: ["customer-menu", currentContext.restaurantId],
                })
              }
            }}
            onPlaceOrder={async ({ customerName, intent }) => {
  
              setCheckoutError("")
              try {
                // `amount` is the server's `amount_due` (items total + tip).
                const amountDue = intent.amountDue ?? intent.amount
                const tipAmount = intent.tipAmount ?? 0
                const total = intent.total ?? roundMoney(amountDue - tipAmount)
                // Split GST on the items total only: tips carry no GST.
                const { subtotal, tax } = splitInclusiveTax(
                  total,
                  currentContext.taxRate,
                )
                const placedOrder: PlacedOrder = {
                  orderId: intent.orderId,
                  orderNumber: intent.orderNumber,
                  trackingToken: intent.trackingToken,
                  status: "pending",
                  subtotal,
                  tax,
                  total,
                  tipAmount,
                  amountDue,
                  currency: intent.currency,
                  taxRate: currentContext.taxRate,
                  restaurantName: currentContext.restaurantName,
                  tableNumber: currentContext.tableNumber,
                  customerName,
                  createdAt: new Date().toISOString(),
                  items: cart.items.map((item) => ({
                    name: item.name,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    subtotal: item.unitPrice * item.quantity,
                    modifiers: (item.modifiers ?? []).map((modifier) => ({
                      name: modifier.name,
                      priceAdjustment: modifier.priceAdjustment,
                    })),
                  })),
                }
  
                if (source) saveLastOrder(source, placedOrder)
                cart.clear()
                setCreatedOrder(placedOrder)
                setScreen("confirmation")
              } catch (error) {
                setCheckoutError(
                  error instanceof Error
                    ? error.message
                    : "Could not place your order.",
                )
              }
            }}
          />
        </Suspense>
      )}
      {screen === "confirmation" && (
        <OrderConfirmation
          order={createdOrder}
          isLoggedIn={Boolean(user)}
          onClose={closeConfirmation}
          onLogin={() => openAuth("login", "confirmation")}
          onSignup={() => openAuth("signup", "confirmation")}
        />
      )}
      {screen === "orders" && user && (
        <OrdersScreen
          customerId={user.id}
          restaurantId={currentContext.restaurantId}
          onAddToCart={(lines) => {
            cart.addLines(lines)
            const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0)
            setCartAnnouncement(
              `${itemCount} ${itemCount === 1 ? "item" : "items"} added to your cart from a previous order.`,
            )
          }}
          onOpenCart={() => setScreen("cart")}
          onClose={() => setScreen("menu")}
        />
      )}
      {(screen === "login" || screen === "signup") && (
        <AuthScreen
          kind={screen}
          onBack={closeAuth}
          onContinue={closeAuth}
        />
      )}
      <footer className={styles["technology-footer"]}>
        Developed by QuickTab Payments Team
      </footer>
      <p className="sr-only" role="status" aria-live="polite">
        {cartAnnouncement}
      </p>
      {selected && (
        <ProductModal
          key={selected.id}
          item={selected}
          currency={currentContext.currency}
          onClose={() => setSelected(null)}
          onAdd={(amount, modifiers) => {
            cart.add(selected, amount, modifiers)
            setCartAnnouncement(
              `${amount} × ${selected.name} added to cart. ${cart.count + amount} ${cart.count + amount === 1 ? "item" : "items"} in your cart.`,
            )
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}

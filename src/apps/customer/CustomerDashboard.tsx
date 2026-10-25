import { useEffect, useMemo, useRef, useState } from "react"
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
import { CheckoutScreen } from "./features/checkout/CheckoutScreen"
import { OrderConfirmation } from "./features/orders/OrderConfirmation"
import { OrdersScreen } from "./features/orders/OrdersScreen"
import { AuthScreen } from "./features/auth/AuthScreen"
import type { MenuItem, QrContext, Screen } from "./types"
import { placeOrder, PlaceOrderError, type PlacedOrder } from "./data/placeOrder"
import { fetchMenu } from "./data/menuApi"
import { clearLastOrder, readLastOrder, saveLastOrder } from "./data/lastOrder"

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
  const [authReturnScreen, setAuthReturnScreen] =
    useState<"menu" | "confirmation">("menu")
  const restoredLastOrder = useRef(false)

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

  const profileName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    user?.email?.split("@")[0] ||
    ""

  if (qrState.status === "loading") {
    return (
      <div className={styles["app-shell"]}>
        <main className="flex min-h-dvh items-center justify-center bg-cream">
          <p role="status" className="text-sm text-ink-mid">
            Opening the menu…
          </p>
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
        />
      )}
      {screen === "cart" && (
        <CartScreen
          items={cart.items}
          total={cart.total}
          currency={currentContext.currency}
          onClose={() => setScreen("menu")}
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
        <CheckoutScreen
          items={cart.items}
          currency={currentContext.currency}
          taxRate={currentContext.taxRate}
          tableNumber={currentContext.tableNumber}
          canCheckout={cart.canCheckout}
          defaultName={profileName}
          onClose={() => {
            setCheckoutError("")
            setScreen("cart")
          }}
          error={checkoutError}
          onPlaceOrder={async ({ customerName, notes }) => {
            setCheckoutError("")
            try {
              const order = await placeOrder({
                restaurantSlug: currentContext.restaurantSlug,
                tableToken: currentContext.tableToken,
                customerName,
                notes,
                items: cart.items,
              })
              if (source) saveLastOrder(source, order)
              cart.clear()
              setCreatedOrder(order)
              setScreen("confirmation")
            } catch (error) {
              if (
                error instanceof PlaceOrderError &&
                error.code === "menu_item_unavailable"
              ) {
                // The menu changed mid-session: refresh it and drop sold-out lines.
                const menu = await fetchMenu(currentContext.restaurantId).catch(
                  () => null,
                )
                if (menu) cart.reconcile(menu.flatMap((category) => category.items))
                void queryClient.invalidateQueries({
                  queryKey: ["customer-menu", currentContext.restaurantId],
                })
              }
              setCheckoutError(
                error instanceof Error
                  ? error.message
                  : "Could not place your order.",
              )
            }
          }}
        />
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
        <OrdersScreen customerId={user.id} onClose={() => setScreen("menu")} />
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
      {selected && (
        <ProductModal
          item={selected}
          currency={currentContext.currency}
          onClose={() => setSelected(null)}
          onAdd={(amount) => {
            cart.add(selected, amount)
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}

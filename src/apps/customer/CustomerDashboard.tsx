import { useEffect, useState } from "react"
import styles from "./App.module.css"
import { useAuth } from "@shared/auth/AuthContext"
import { AUTH_RETURN_KEY } from "./constants"
import { useCart } from "./hooks/useCart"
import { MenuScreen } from "./features/menu/MenuScreen"
import { ProductModal } from "./features/menu/ProductModal"
import { CartScreen } from "./features/cart/CartScreen"
import { CheckoutScreen } from "./features/checkout/CheckoutScreen"
import { OrderConfirmation } from "./features/orders/OrderConfirmation"
import { OrdersScreen } from "./features/orders/OrdersScreen"
import { AuthScreen } from "./features/auth/AuthScreen"
import type { Product, Screen } from "./types"
import { createOrder, type CreatedOrder } from "./data/orders"

export default function App() {
  const { user, profile } = useAuth()
  const [screen, setScreen] = useState<Screen>("menu")
  const [selected, setSelected] = useState<Product | null>(null)
  const [customerName, setCustomerName] = useState("")
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null)
  const [checkoutError, setCheckoutError] = useState("")
  const [authReturnScreen, setAuthReturnScreen] = useState<"menu" | "confirmation">("menu")
  const cart = useCart()

  const openAuth = (authScreen: "login" | "signup", returnTo: "menu" | "confirmation") => {
    setAuthReturnScreen(returnTo)
    // Persisted so we can return here after an OAuth redirect reloads the page.
    window.sessionStorage.setItem(AUTH_RETURN_KEY, returnTo)
    setScreen(authScreen)
  }

  const closeAuth = () => {
    window.sessionStorage.removeItem(AUTH_RETURN_KEY)
    setScreen(authReturnScreen)
  }

  // After an OAuth redirect the page reloads with a session; return to the screen where auth began.
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
  const menu = () => setScreen("menu")

  return (
    <div className={`${styles["app-shell"]} ${screen === "menu" ? styles["with-sidebar"] : ""}`}>
      {screen === "menu" && <MenuScreen
        cartCount={cart.count}
        total={cart.total}
        onOpenCart={() => setScreen("cart")}
        onOpenOrders={() => setScreen("orders")}
        onSelect={setSelected}
        onAuth={(authScreen) => openAuth(authScreen, "menu")}
      />}
      {screen === "cart" && <CartScreen
        items={cart.items}
        total={cart.total}
        onClose={menu}
        onRemove={cart.remove}
        onDecrease={cart.decrease}
        onIncrease={cart.increase}
        onCheckout={() => setScreen("checkout")}
      />}
      {screen === "checkout" && <CheckoutScreen
        total={cart.total}
        defaultName={profileName}
        onClose={() => setScreen("cart")}
        error={checkoutError}
        onPay={async (name) => {
          setCheckoutError("")
          try {
            const order = await createOrder({
              customerName: name,
              customerId: user?.id ?? null,
              items: cart.items,
              total: cart.total,
            })
            setCustomerName(name)
            setCreatedOrder(order)
            setScreen("confirmation")
          } catch (error) {
            setCheckoutError(error instanceof Error ? error.message : "Could not save your order.")
          }
        }}
      />}
      {screen === "confirmation" && <OrderConfirmation
        customerName={customerName}
        orderNumber={createdOrder?.orderNumber ?? ""}
        isLoggedIn={Boolean(user)}
        onLogin={() => openAuth("login", "confirmation")}
        onSignup={() => openAuth("signup", "confirmation")}
        onClose={() => {
          cart.clear()
          setCustomerName("")
          setCreatedOrder(null)
          menu()
        }}
      />}
      {screen === "orders" && user && <OrdersScreen customerId={user.id} onClose={menu} />}
      {(screen === "login" || screen === "signup") && <AuthScreen kind={screen} onBack={closeAuth} onContinue={closeAuth} />}
      <footer className={styles["technology-footer"]}>Developed by QuickTab Payments Team</footer>
      {selected && <ProductModal
        product={selected}
        onClose={() => setSelected(null)}
        onAdd={(amount) => {
          cart.add(selected.name, amount)
          setSelected(null)
        }}
      />}
    </div>
  )
}

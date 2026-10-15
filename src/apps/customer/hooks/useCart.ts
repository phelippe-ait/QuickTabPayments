import { useMemo, useState } from "react"
import { products } from "../data/menu"

export function useCart() {
  const [cart, setCart] = useState<Record<string, number>>({})
  const items = useMemo(
    () => products
      .filter((product) => (cart[product.name] ?? 0) > 0)
      .map((product) => ({ product, quantity: cart[product.name] })),
    [cart],
  )
  const count = useMemo(
    () => items.reduce((totalCount, item) => totalCount + item.quantity, 0),
    [items],
  )
  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [items],
  )

  const remove = (productName: string) => setCart((current) => {
    const next = { ...current }
    delete next[productName]
    return next
  })
  const decrease = (productName: string) => setCart((current) => ({
    ...current,
    [productName]: Math.max(0, (current[productName] ?? 0) - 1),
  }))
  const increase = (productName: string) => setCart((current) => ({
    ...current,
    [productName]: (current[productName] ?? 0) + 1,
  }))
  const add = (productName: string, amount: number) => setCart((current) => ({
    ...current,
    [productName]: (current[productName] ?? 0) + amount,
  }))
  const clear = () => setCart({})

  return { items, count, total, add, remove, decrease, increase, clear }
}

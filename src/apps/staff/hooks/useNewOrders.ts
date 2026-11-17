import { useCallback, useRef, useState } from "react"
import { findNewOrderIds } from "./findNewOrderIds"

export type NewOrdersTracker = {
  /** Order numbers that arrived while the board was open and are still unseen. */
  unseenOrderIds: ReadonlySet<string>
  /** Records a board fetch and returns the ids that were not known before. */
  observe: (orders: ReadonlyArray<{ id: string }>) => string[]
  /** Records a single order (Realtime); true when it had not been seen yet. */
  register: (orderId: string) => boolean
  isUnseen: (orderId: string) => boolean
  markSeen: (orderId: string) => void
  reset: () => void
}

/**
 * Tracks kitchen orders that arrived while the board was open and that the
 * kitchen has not acknowledged yet.
 *
 * An order becomes "seen" when staff act on it — opening its action
 * confirmation acknowledges it and advancing its status also marks it seen
 * (see `KitchenWorkspace` / `useStaffWorkspace`). We deliberately do not
 * expire the highlight on a timer: a kitchen that muted audio and looked away
 * must still find the unread count when it looks back.
 */
export function useNewOrders(): NewOrdersTracker {
  // `null` until the first board fetch. Pre-existing orders are the baseline,
  // so hydrating the board never flags or chimes for orders already cooking.
  const knownOrderIdsRef = useRef<Set<string> | null>(null)
  const [unseenOrderIds, setUnseenOrderIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  )

  const addUnseen = useCallback((orderIds: readonly string[]) => {
    setUnseenOrderIds((current) => {
      const next = new Set(current)
      for (const orderId of orderIds) next.add(orderId)
      return next.size === current.size ? current : next
    })
  }, [])

  const observe = useCallback(
    (orders: ReadonlyArray<{ id: string }>) => {
      const additions = findNewOrderIds(knownOrderIdsRef.current, orders)
      knownOrderIdsRef.current = new Set(orders.map((order) => order.id))
      if (additions.length > 0) addUnseen(additions)
      return additions
    },
    [addUnseen],
  )

  const register = useCallback(
    (orderId: string) => {
      const known = knownOrderIdsRef.current
      // Realtime can beat the first fetch. Without a baseline we cannot tell a
      // genuinely new order from one that was already on the board.
      if (!known || known.has(orderId)) return false
      known.add(orderId)
      addUnseen([orderId])
      return true
    },
    [addUnseen],
  )

  const isUnseen = useCallback(
    (orderId: string) => unseenOrderIds.has(orderId),
    [unseenOrderIds],
  )

  const markSeen = useCallback((orderId: string) => {
    setUnseenOrderIds((current) => {
      if (!current.has(orderId)) return current
      const next = new Set(current)
      next.delete(orderId)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    knownOrderIdsRef.current = null
    setUnseenOrderIds((current) => (current.size === 0 ? current : new Set()))
  }, [])

  return { unseenOrderIds, observe, register, isUnseen, markSeen, reset }
}

import type { CartItem } from "../types";
import { supabase } from "@shared/lib/supabase";

const restaurantSlug = import.meta.env.VITE_RESTAURANT_SLUG || "quicktab-demo-cafe";

export type CreatedOrder = {
  id: string;
  orderNumber: string;
};

export type CustomerOrder = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  items: Array<{ name: string; quantity: number; subtotal: number }>;
};

const parseOrderItems = (notes: string | null): CustomerOrder["items"] => {
  if (!notes) return [];
  try {
    const snapshot: unknown = JSON.parse(notes);
    if (!snapshot || typeof snapshot !== "object" || !("items" in snapshot)) return [];
    const items = (snapshot as { items?: unknown }).items;
    if (!Array.isArray(items)) return [];
    return items.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      if (typeof row.name !== "string" || typeof row.quantity !== "number") return [];
      return [{
        name: row.name,
        quantity: row.quantity,
        subtotal: typeof row.subtotal === "number" ? row.subtotal : 0,
      }];
    });
  } catch {
    return [];
  }
};

export async function getCustomerOrderHistory(customerId: string): Promise<CustomerOrder[]> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id")
    .eq("slug", restaurantSlug)
    .eq("is_active", true)
    .single();
  if (restaurantError || !restaurant) {
    console.error("Could not find active restaurant", restaurantError);
    throw new Error("This restaurant is unavailable. Please try again later.");
  }

  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, status, total, notes, created_at")
    .eq("restaurant_id", restaurant.id)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Could not load customer order history", error);
    throw new Error("Could not load your order history. Please try again.");
  }

  return (data ?? []).map((order) => ({
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    total: Number(order.total),
    createdAt: order.created_at,
    items: parseOrderItems(order.notes),
  }));
}

export async function createOrder(input: {
  customerName: string;
  customerId: string | null;
  items: CartItem[];
  total: number;
}): Promise<CreatedOrder> {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (input.items.length === 0) throw new Error("Your cart is empty.");

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id")
    .eq("slug", restaurantSlug)
    .eq("is_active", true)
    .single();
  if (restaurantError || !restaurant) {
    console.error("Could not find active restaurant", restaurantError);
    throw new Error("This restaurant is unavailable. Please try again later.");
  }

  const orderNumber = `QT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const orderId = crypto.randomUUID();
  const { error } = await supabase
    .from("orders")
    .insert({
      id: orderId,
      restaurant_id: restaurant.id,
      customer_id: input.customerId,
      order_number: orderNumber,
      status: "pending",
      subtotal: input.total,
      tax: 0,
      total: input.total,
      // The current customer menu is a local demo catalog, so it has no
      // menu_item_id values to reference in order_items yet. Keep the exact
      // item and price snapshots with the pending order until the menu is DB-backed.
      notes: JSON.stringify({
        customerName: input.customerName,
        items: input.items.map(({ product, quantity }) => ({
          name: product.name,
          unitPrice: product.price,
          quantity,
          subtotal: product.price * quantity,
        })),
      }),
    });

  if (error) {
    console.error("Could not create order", error);
    throw new Error(error.message || "Could not save your order.");
  }

  return { id: orderId, orderNumber };
}

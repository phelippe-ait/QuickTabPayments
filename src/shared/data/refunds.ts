import { requireSupabase } from "./client";
import type { Refund, TablesInsert } from "@shared/lib/database.types";

export async function fetchRefundsForOrder(orderId: string): Promise<Refund[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("refunds")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createRefund(
  input: TablesInsert<"refunds">,
): Promise<Refund> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("refunds")
    .insert(input)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      error.code === "23505"
        ? "This refund looks like it was already recorded."
        : error.message,
    );
  }
  return data;
}

export const refundKeys = {
  byOrder: (orderId: string) => ["refunds", orderId] as const,
};

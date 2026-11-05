import { requireSupabase } from "./client";
import { supabase } from "@shared/lib/supabase";
import type { Refund, TablesInsert } from "@shared/lib/database.types";

export type StripeRefundInput = {
  orderId: string;
  paymentId: string;
  amount: number;
  reason?: string | null;
  orderItemId?: string | null;
  quantity?: number | null;
};

/**
 * Ask the server to create a real Stripe refund and persist the refund row.
 * The caller's access token is forwarded so the API can verify the role.
 */
export async function requestStripeRefund(
  input: StripeRefundInput,
): Promise<Refund> {
  let token: string | null = null;
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token ?? null;
  }
  if (!token) throw new Error("You need to sign in again to issue a refund.");

  const response = await fetch("/api/refunds", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => ({}))) as
    | Refund
    | { error?: string };

  if (!response.ok) {
    throw new Error(
      "error" in payload && payload.error
        ? payload.error
        : "The refund could not be processed.",
    );
  }

  return payload as Refund;
}

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

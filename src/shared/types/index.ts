/**
 * Shared domain types.
 *
 * These describe the cross-app model shared by the customer, staff, and admin
 * applications (Restaurant, Table, MenuItem, Order, User, ...).
 *
 * Keep them aligned with the database schema in `../../../database/schema.sql`.
 * The intent is to eventually generate these from Supabase
 * (`supabase gen types typescript`) — until then, treat this folder as the
 * interim source of truth so the three apps do not diverge.
 */

/** Workspace role — governs access to the customer, staff, and admin apps. */
export type Role = "customer" | "staff" | "manager" | "admin";

export {};

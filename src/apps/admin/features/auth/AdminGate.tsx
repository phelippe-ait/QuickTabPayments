/**
 * Admin auth gate. The full staircase lives in the shared gate so the staff
 * workspace can reuse the exact same rules with different copy.
 */
export { RequireStaff } from "@shared/auth/RequireStaff";

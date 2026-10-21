import type {
  OrderStatus,
  PaymentStatus,
  StaffRole,
} from "@shared/lib/database.types";

/**
 * Admin view models. These are UI-shaped, never database rows: hooks map
 * Supabase rows through `mappers.ts` before components see them.
 */

export type MenuItemVM = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  description: string;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  displayOrder: number;
};

export type CategoryVM = {
  id: string;
  name: string;
  displayOrder: number;
};

export type TableVM = {
  id: string;
  number: string;
  locationLabel: string | null;
  seats: number | null;
  isActive: boolean;
  qrToken: string;
  openOrder: {
    orderNumber: string;
    status: OrderStatus;
    startedAt: string;
  } | null;
};

export type StaffVM = {
  staffId: string;
  userId: string;
  name: string;
  email: string;
  initials: string;
  role: StaffRole;
  isActive: boolean;
};

export type OrderLineVM = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  imageUrl: string | null;
  notes: string | null;
};

export type PaymentVM = {
  id: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  method: string;
  paidAt: string | null;
  receiptUrl: string | null;
  failureReason: string | null;
};

export type OrderVM = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  createdAtLabel: string;
  total: number;
  subtotal: number;
  tax: number;
  currency: string;
  tableNumber: string | null;
  customerName: string;
  lineItems: OrderLineVM[];
  payments: PaymentVM[];
  refundedTotal: number;
};

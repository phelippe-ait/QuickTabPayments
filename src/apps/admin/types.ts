export type Section = "catalog" | "tables" | "users" | "orders" | "settings";

export type MenuItem = {
  id: number;
  name: string;
  category: string;
  description: string;
  price: number;
  image: string;
  available: boolean;
};

export type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: "Active" | "Inactive";
  initials: string;
};

export type CafeTable = {
  id: number;
  number: string;
  available: boolean;
  location: "Indoors" | "Outdoors" | "Pick-up";
  seats?: number;
  currentOrder?: string;
  seatedAt?: string;
};

export type Confirmation = {
  title: string;
  description: string;
  actionLabel: string;
  onConfirm: () => void;
};

export type OrderLineItem = {
  name: string;
  quantity: number;
  price: string;
  image: string;
};

export type Order = {
  id: string;
  table: string;
  customer: string;
  items: string;
  date: string;
  total: string;
  status: "Active" | "Completed" | "Canceled";
  payment: string;
  refundedAmount: number;
  lineItems: OrderLineItem[];
};

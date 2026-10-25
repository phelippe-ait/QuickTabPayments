export type Section =
  | "catalog"
  | "tables"
  | "users"
  | "orders"
  | "settings";

export type Confirmation = {
  title: string;
  description: string;
  actionLabel: string;
  onConfirm: () => void;
};

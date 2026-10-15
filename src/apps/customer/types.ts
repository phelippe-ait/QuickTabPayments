export type Screen =
  | "menu"
  | "cart"
  | "checkout"
  | "confirmation"
  | "login"
  | "signup"
  | "orders";
export type Category = "Hot Beverages" | "Breakfast" | "Lunch";

export type Product = {
  name: string;
  description: string;
  price: number;
  category: Category;
  image: string;
  imagePosition?: string;
};

export type CartItem = {
  product: Product;
  quantity: number;
};

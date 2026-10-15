import type { Category, Product } from "../types"

export const products: Product[] = [
  {
    name: "Flat White",
    description: "Smooth, creamy, and just the right amount of coffee kick.",
    price: 4.7,
    category: "Hot Beverages",
    image: "/assets/flat-white.jpg",
    imagePosition: "56% center",
  },
  {
    name: "Babyccino",
    description:
      "A frothy, steamed milk beverage for kids, often topped with a sprinkle of cocoa or cinnamon.",
    price: 2.5,
    category: "Hot Beverages",
    image: "/assets/babyccino.jpg",
  },
  {
    name: "Mocha",
    description:
      "A delicious blend of espresso, chocolate, and steamed milk. A sweet indulgence.",
    price: 5,
    category: "Hot Beverages",
    image: "/assets/mocha.jpg",
    imagePosition: "56% center",
  },
  {
    name: "Cappuccino",
    description:
      "Silky, rich, and deeply chocolatey with a generous cap of foam.",
    price: 4.5,
    category: "Hot Beverages",
    image: "/assets/cappuccino.jpg",
    imagePosition: "center 57%",
  },
  {
    name: "Avocado Toast",
    description:
      "Sourdough toast with smashed avocado, feta, herbs, and lemon.",
    price: 11.5,
    category: "Breakfast",
    image: "/assets/avocado-toast.jpg",
  },
  {
    name: "Berry Pancakes",
    description:
      "Fluffy pancakes with seasonal berries, maple syrup, and whipped butter.",
    price: 12,
    category: "Breakfast",
    image: "/assets/berry-pancakes.jpg",
  },
  {
    name: "Butter Croissant",
    description:
      "A flaky, golden croissant served warm with cultured butter and jam.",
    price: 5.5,
    category: "Breakfast",
    image: "/assets/butter-croissant.jpg",
  },
  {
    name: "Chicken Club",
    description:
      "Roast chicken, crisp lettuce, tomato, bacon, and herb mayo on toasted bread.",
    price: 13.5,
    category: "Lunch",
    image: "/assets/chicken-club.jpg",
  },
  {
    name: "Garden Salad",
    description:
      "Seasonal greens, cucumber, tomato, avocado, and a bright lemon dressing.",
    price: 12.5,
    category: "Lunch",
    image: "/assets/garden-salad.jpg",
  },
  {
    name: "Pesto Panini",
    description:
      "Toasted panini with mozzarella, tomato, basil pesto, and a crisp side salad.",
    price: 14,
    category: "Lunch",
    image: "/assets/pesto-panini.jpg",
  },
];

export const categories: Category[] = ["Hot Beverages", "Breakfast", "Lunch"];
export const tableNumber = 3;

export const orderStatuses = [
  {
    label: "Order confirmed",
    message: "We've received your order and sent it to the kitchen.",
  },
  {
    label: "Preparing order",
    message: "The kitchen is preparing your order now.",
  },
  {
    label: "Order ready",
    message: "Your order is ready to collect.",
  },
] as const;

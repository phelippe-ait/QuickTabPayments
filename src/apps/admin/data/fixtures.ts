import type { Order, User } from "../types"

export const starterUsers: User[] = [
  { id: 1, name: "Maya Johnson", email: "maya@cafeshop.co", role: "Manager", status: "Active", initials: "MJ" },
  { id: 2, name: "Theo Martin", email: "theo@cafeshop.co", role: "Staff", status: "Active", initials: "TM" },
  { id: 3, name: "Isla Chen", email: "isla@cafeshop.co", role: "Staff", status: "Active", initials: "IC" },
  { id: 4, name: "Noah Williams", email: "noah@cafeshop.co", role: "Staff", status: "Inactive", initials: "NW" },
]

export const starterOrders: Order[] = [
  { id: "#1048", table: "02", customer: "Olivia Moore", items: "2 items", date: `Today, ${new Date(Date.now() - 18 * 60 * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`, total: "$12.40", status: "Active", payment: "Visa •••• 4242", refundedAmount: 0, lineItems: [{ name: "Flat White", quantity: 2, price: "$9.40", image: "/menu/flat-white.jpg" }, { name: "Babyccino", quantity: 1, price: "$2.50", image: "/menu/babyccino.jpg" }] },
  { id: "#1047", table: "03", customer: "James Smith", items: "3 items", date: "Today, 9:18 AM", total: "$18.20", status: "Completed", payment: "Mastercard •••• 1881", refundedAmount: 0, lineItems: [{ name: "Cappuccino", quantity: 2, price: "$9.00", image: "/menu/cappuccino.jpg" }, { name: "Mocha", quantity: 1, price: "$5.00", image: "/menu/mocha.jpg" }, { name: "Ceremonial Matcha", quantity: 1, price: "$4.20", image: "/menu/matcha.jpg" }] },
  { id: "#1046", table: "05", customer: "Emma Davis", items: "1 item", date: "Yesterday, 4:32 PM", total: "$5.80", status: "Completed", payment: "Visa •••• 6038", refundedAmount: 5.8, lineItems: [{ name: "Ceremonial Matcha", quantity: 1, price: "$5.80", image: "/menu/matcha.jpg" }] },
  { id: "#1045", table: "01", customer: "Liam Wilson", items: "4 items", date: "Yesterday, 1:05 PM", total: "$26.90", status: "Canceled", payment: "Apple Pay", refundedAmount: 0, lineItems: [{ name: "Flat White", quantity: 2, price: "$9.40", image: "/menu/flat-white.jpg" }, { name: "Mocha", quantity: 2, price: "$10.00", image: "/menu/mocha.jpg" }, { name: "Babyccino", quantity: 1, price: "$2.50", image: "/menu/babyccino.jpg" }, { name: "Cappuccino", quantity: 1, price: "$5.00", image: "/menu/cappuccino.jpg" }] },
  { id: "#1044", table: "04", customer: "Sophia Brown", items: "2 items", date: "May 21, 11:48 AM", total: "$9.40", status: "Completed", payment: "Visa •••• 0914", refundedAmount: 0, lineItems: [{ name: "Flat White", quantity: 1, price: "$4.70", image: "/menu/flat-white.jpg" }, { name: "Cappuccino", quantity: 1, price: "$4.70", image: "/menu/cappuccino.jpg" }] },
]

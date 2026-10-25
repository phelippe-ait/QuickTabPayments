import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ProductModal } from "./ProductModal"
import type { MenuItem } from "../../types"

const item: MenuItem = {
  id: "item-1",
  name: "Flat White",
  description: "Smooth and creamy",
  price: 4.7,
  imageUrl: null,
  allergens: ["milk"],
  categoryId: "category-1",
  displayOrder: 0,
}

describe("ProductModal", () => {
  it("does not expose the kitchen prep time to customers", () => {
    render(
      <ProductModal
        item={item}
        currency="AUD"
        onClose={vi.fn()}
        onAdd={vi.fn()}
      />,
    )

    expect(screen.getByText("Flat White")).toBeInTheDocument()
    expect(screen.queryByText(/Prep time:/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/about 4 min/i)).not.toBeInTheDocument()
  })
})

import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { ProductModal } from "./ProductModal"
import type { MenuItem } from "../../types"

const item: MenuItem = {
  id: "item-1",
  name: "Flat White",
  description: "Smooth and creamy",
  price: 4.7,
  imageUrl: null,
  allergens: ["milk"],
  dietaryTags: ["Vegetarian"],
  categoryId: "category-1",
  displayOrder: 0,
}

const itemWithModifiers: MenuItem = {
  ...item,
  modifierGroups: [
    {
      id: "group-size",
      name: "Cup size",
      selectionType: "single",
      minSelections: 1,
      maxSelections: 1,
      isRequired: true,
      options: [
        { id: "size-regular", name: "Regular", priceAdjustment: 0 },
        { id: "size-large", name: "Large", priceAdjustment: 1 },
      ],
    },
    {
      id: "group-sauce",
      name: "Sauce",
      selectionType: "single",
      minSelections: 1,
      maxSelections: 1,
      isRequired: true,
      options: [
        { id: "sauce-tomato", name: "Tomato", priceAdjustment: 0 },
        { id: "sauce-bbq", name: "BBQ", priceAdjustment: 0 },
      ],
    },
  ],
}

function renderModal(menuItem: MenuItem = item, onAdd = vi.fn()) {
  render(
    <ProductModal
      item={menuItem}
      currency="AUD"
      onClose={vi.fn()}
      onAdd={onAdd}
    />,
  )
  return { onAdd }
}

describe("ProductModal", () => {
  it("does not expose the kitchen prep time to customers", () => {
    renderModal()

    expect(screen.getByText("Flat White")).toBeInTheDocument()
    expect(screen.queryByText(/Prep time:/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/about 4 min/i)).not.toBeInTheDocument()
  })

  it("disables Add until every required modifier group has a choice", () => {
    renderModal(itemWithModifiers)

    const add = screen.getByRole("button", { name: /Add to Order/ })
    expect(add).toBeDisabled()
    expect(screen.getByRole("alert")).toHaveTextContent(/Please choose Cup size/i)

    fireEvent.click(screen.getByRole("radio", { name: /Regular/ }))
    expect(add).toBeDisabled()

    fireEvent.click(screen.getByRole("radio", { name: /Tomato/ }))
    expect(add).toBeEnabled()
  })

  it("keeps a single-select group to exactly one choice", () => {
    renderModal(itemWithModifiers)

    const regular = screen.getByRole("radio", { name: /Regular/ })
    const large = screen.getByRole("radio", { name: /Large/ })

    fireEvent.click(regular)
    expect(regular).toBeChecked()
    expect(large).not.toBeChecked()

    fireEvent.click(large)
    expect(large).toBeChecked()
    expect(regular).not.toBeChecked()
  })

  it("shows the live line total on the Add button", () => {
    renderModal(itemWithModifiers)

    fireEvent.click(screen.getByRole("radio", { name: /Large/ }))
    fireEvent.click(screen.getByRole("radio", { name: /Tomato/ }))
    fireEvent.click(screen.getByRole("button", { name: /Increase quantity/ }))

    expect(
      screen.getByRole("button", { name: /Add to Order.*11\.40/ }),
    ).toBeInTheDocument()
  })

  it("passes the selected modifiers and quantity to the cart", () => {
    const { onAdd } = renderModal(itemWithModifiers)

    fireEvent.click(screen.getByRole("radio", { name: /Large/ }))
    fireEvent.click(screen.getByRole("radio", { name: /BBQ/ }))
    fireEvent.click(screen.getByRole("button", { name: /Add to Order/ }))

    expect(onAdd).toHaveBeenCalledWith(1, [
      {
        id: "size-large",
        name: "Large",
        priceAdjustment: 1,
        groupName: "Cup size",
      },
      {
        id: "sauce-bbq",
        name: "BBQ",
        priceAdjustment: 0,
        groupName: "Sauce",
      },
    ])
  })
})

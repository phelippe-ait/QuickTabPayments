import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { CategoryVM, MenuItemVM } from "../../viewModels"
import { ItemModal, SectionsModal } from "./CatalogDialogs"

const categories: CategoryVM[] = [
  { id: "cat-a", name: "Hot Beverages", displayOrder: 0 },
  { id: "cat-b", name: "Breakfast", displayOrder: 1 },
]

const item: MenuItemVM = {
  id: "item-1",
  name: "Flat White",
  categoryId: "cat-a",
  categoryName: "Hot Beverages",
  description: "Smooth and creamy",
  price: 4.7,
  imageUrl: null,
  isAvailable: true,
  prepTimeMinutes: 10,
  displayOrder: 0,
}

function submitForm() {
  const form = screen
    .getByRole("button", { name: /add item|save changes/i })
    .closest("form")
  fireEvent.submit(form!)
}

describe("ItemModal", () => {
  it("requires a name before creating an item", () => {
    const onCreate = vi.fn(async () => true)
    render(
      <ItemModal
        item={null}
        categories={categories}
        restaurantId="restaurant-1"
        onClose={vi.fn()}
        onCreate={onCreate}
        onUpdate={vi.fn(async () => true)}
      />,
    )

    submitForm()

    expect(screen.getByText(/item name is required/i)).toBeInTheDocument()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it("rejects a negative price", () => {
    const onCreate = vi.fn(async () => true)
    render(
      <ItemModal
        item={null}
        categories={categories}
        restaurantId="restaurant-1"
        onClose={vi.fn()}
        onCreate={onCreate}
        onUpdate={vi.fn(async () => true)}
      />,
    )

    fireEvent.change(screen.getByLabelText(/item name/i), {
      target: { value: "Matcha" },
    })
    fireEvent.change(screen.getByLabelText(/price/i), {
      target: { value: "-1" },
    })
    submitForm()

    expect(screen.getByText(/price must be zero or more/i)).toBeInTheDocument()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it("uploads nothing and creates the item with a generated id", async () => {
    const onCreate = vi.fn(async () => true)
    const onClose = vi.fn()
    render(
      <ItemModal
        item={null}
        categories={categories}
        restaurantId="restaurant-1"
        onClose={onClose}
        onCreate={onCreate}
        onUpdate={vi.fn(async () => true)}
      />,
    )

    fireEvent.change(screen.getByLabelText(/item name/i), {
      target: { value: "Matcha" },
    })
    fireEvent.change(screen.getByLabelText(/price/i), {
      target: { value: "5.80" },
    })
    fireEvent.change(screen.getByLabelText(/prep time/i), {
      target: { value: "6" },
    })
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "Whisked to order" },
    })
    submitForm()

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        name: "Matcha",
        categoryId: "cat-a",
        price: 5.8,
        imageUrl: null,
        isAvailable: true,
        prepTimeMinutes: 6,
      }),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it("rejects an invalid prep time", () => {
    const onCreate = vi.fn(async () => true)
    render(
      <ItemModal
        item={null}
        categories={categories}
        restaurantId="restaurant-1"
        onClose={vi.fn()}
        onCreate={onCreate}
        onUpdate={vi.fn(async () => true)}
      />,
    )

    fireEvent.change(screen.getByLabelText(/item name/i), {
      target: { value: "Matcha" },
    })
    fireEvent.change(screen.getByLabelText(/price/i), {
      target: { value: "5.80" },
    })
    fireEvent.change(screen.getByLabelText(/prep time/i), {
      target: { value: "-1" },
    })
    submitForm()

    expect(
      screen.getByText(/prep time must be a whole number/i),
    ).toBeInTheDocument()
    expect(onCreate).not.toHaveBeenCalled()
  })
})

describe("SectionsModal delete flow", () => {
  it("offers to move items when the category is not empty", async () => {
    const onDelete = vi
      .fn<(id: string) => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    const onMoveItems = vi.fn(async () => true)

    render(
      <SectionsModal
        categories={categories}
        items={[item]}
        onClose={vi.fn()}
        onCreate={vi.fn(async () => true)}
        onRename={vi.fn(async () => true)}
        onDelete={onDelete}
        onMoveItems={onMoveItems}
        onReorder={vi.fn(async () => true)}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /delete hot beverages/i }))

    expect(
      await screen.findByText(/still has 1 item/i),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /move & delete/i }))

    await waitFor(() =>
      expect(onMoveItems).toHaveBeenCalledWith(["item-1"], "cat-b"),
    )
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(2))
  })

  it("renames sections by id without touching item data", async () => {
    const onRename = vi.fn(async () => true)
    const onClose = vi.fn()

    render(
      <SectionsModal
        categories={categories}
        items={[item]}
        onClose={onClose}
        onCreate={vi.fn(async () => true)}
        onRename={onRename}
        onDelete={vi.fn(async () => true)}
        onMoveItems={vi.fn(async () => true)}
        onReorder={vi.fn(async () => true)}
      />,
    )

    fireEvent.change(screen.getByLabelText(/section 1 name/i), {
      target: { value: "Coffee" },
    })
    fireEvent.click(screen.getByRole("button", { name: /save sections/i }))

    await waitFor(() =>
      expect(onRename).toHaveBeenCalledWith("cat-a", "Coffee"),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})

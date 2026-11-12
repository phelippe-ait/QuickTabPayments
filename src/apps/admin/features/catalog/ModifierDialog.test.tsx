import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ModifierGroupWithOptions } from "@shared/data/modifiers"
import type { MenuItemVM } from "../../viewModels"
import { ModifierDialog, type ModifierDialogProps } from "./ModifierDialog"

vi.mock("../../hooks/AdminUiProvider", () => ({
  useAdminUi: () => ({
    notify: vi.fn(),
    notifyError: vi.fn(),
    confirm: (confirmation: { onConfirm: () => void }) =>
      confirmation.onConfirm(),
  }),
}))

const item: MenuItemVM = {
  id: "item-1",
  name: "Latte",
  categoryId: "cat-a",
  categoryName: "Coffee",
  description: "Espresso and milk",
  price: 4.5,
  imageUrl: null,
  allergens: [],
  dietaryTags: [],
  isAvailable: true,
  prepTimeMinutes: 5,
  displayOrder: 0,
}

const sizeGroup: ModifierGroupWithOptions = {
  id: "group-1",
  restaurant_id: "restaurant-1",
  name: "Size",
  selection_type: "single",
  min_selections: 0,
  max_selections: 1,
  is_required: false,
  display_order: 0,
  created_at: "2026-01-01T00:00:00Z",
  modifiers: [],
}

function baseProps(
  overrides: Partial<ModifierDialogProps> = {},
): ModifierDialogProps {
  return {
    item,
    currency: "AUD",
    groups: [],
    links: [],
    isLoading: false,
    error: null,
    onRetry: vi.fn(),
    onClose: vi.fn(),
    onCreateGroup: vi.fn(async () => true),
    onUpdateGroup: vi.fn(async () => true),
    onDeleteGroup: vi.fn(async () => true),
    onAddModifier: vi.fn(async () => true),
    onUpdateOption: vi.fn(async () => true),
    onDeleteOption: vi.fn(async () => true),
    onReorderOptions: vi.fn(async () => true),
    onSetGroupLink: vi.fn(async () => true),
    ...overrides,
  }
}

describe("ModifierDialog group validation", () => {
  it("clamps a single-select group to a maximum of one choice", async () => {
    const onCreateGroup = vi.fn(async () => true)
    render(<ModifierDialog {...baseProps({ onCreateGroup })} />)

    fireEvent.change(screen.getByLabelText(/group name/i), {
      target: { value: "Size" },
    })
    fireEvent.change(screen.getByLabelText(/maximum selections/i), {
      target: { value: "5" },
    })
    fireEvent.click(screen.getByRole("button", { name: /create group/i }))

    await waitFor(() => expect(onCreateGroup).toHaveBeenCalledTimes(1))
    expect(onCreateGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Size",
        selectionType: "single",
        minSelections: 0,
        maxSelections: 1,
      }),
    )
  })

  it("rejects a required multiple group with a minimum of zero", () => {
    const onCreateGroup = vi.fn(async () => true)
    render(<ModifierDialog {...baseProps({ onCreateGroup })} />)

    fireEvent.change(screen.getByLabelText(/group name/i), {
      target: { value: "Extras" },
    })
    fireEvent.change(screen.getByLabelText(/selection type/i), {
      target: { value: "multiple" },
    })
    fireEvent.click(screen.getByLabelText(/required group/i))
    fireEvent.click(screen.getByRole("button", { name: /create group/i }))

    expect(
      screen.getByText(/required groups need a minimum of at least one/i),
    ).toBeInTheDocument()
    expect(onCreateGroup).not.toHaveBeenCalled()
  })
})

describe("ModifierDialog attachments", () => {
  it("links an unattached group and unlinks an attached one", async () => {
    const onSetGroupLink = vi.fn(async () => true)
    const { rerender } = render(
      <ModifierDialog
        {...baseProps({ groups: [sizeGroup], onSetGroupLink })}
      />,
    )

    fireEvent.click(screen.getByLabelText(/attach size/i))

    await waitFor(() =>
      expect(onSetGroupLink).toHaveBeenCalledWith("item-1", "group-1", true),
    )

    rerender(
      <ModifierDialog
        {...baseProps({
          groups: [sizeGroup],
          links: [
            {
              menu_item_id: "item-1",
              modifier_group_id: "group-1",
              display_order: 0,
            },
          ],
          onSetGroupLink,
        })}
      />,
    )

    fireEvent.click(screen.getByLabelText(/detach size/i))

    await waitFor(() =>
      expect(onSetGroupLink).toHaveBeenLastCalledWith(
        "item-1",
        "group-1",
        false,
      ),
    )
  })

  it("shows the empty state when no groups exist", () => {
    render(<ModifierDialog {...baseProps()} />)

    expect(screen.getByText(/no groups yet/i)).toBeInTheDocument()
  })
})

import { useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createModifier,
  createModifierGroup,
  deleteModifier,
  deleteModifierGroup,
  fetchModifierCatalog,
  linkModifierGroup,
  modifierKeys,
  reorderModifiers,
  unlinkModifierGroup,
  updateModifier,
  updateModifierGroup,
} from "@shared/data/modifiers"
import type {
  ModifierGroupWithOptions,
  ModifierCatalog,
} from "@shared/data/modifiers"
import type {
  MenuItemModifierGroup,
  ModifierSelection,
  TablesUpdate,
} from "@shared/lib/database.types"

export type NewModifierGroupInput = {
  name: string
  selectionType: ModifierSelection
  isRequired: boolean
  minSelections: number
  maxSelections: number
  displayOrder: number
}

export type NewModifierInput = {
  groupId: string
  name: string
  priceAdjustment: number
  isAvailable: boolean
  displayOrder: number
}

type UseModifiersOptions = {
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

type Task = {
  run: () => Promise<unknown>
  message: string
}

/**
 * Restaurant modifier groups, their options, and the per-item attachments.
 * Every mutation invalidates the restaurant's modifier keys so the catalog
 * dialog always reflects what the customer menu will read.
 */
export function useModifiers(
  restaurantId: string,
  options: UseModifiersOptions = {},
) {
  const queryClient = useQueryClient()

  const catalogQuery = useQuery({
    queryKey: modifierKeys.catalog(restaurantId),
    queryFn: () => fetchModifierCatalog(restaurantId),
    enabled: Boolean(restaurantId),
  })

  const catalog = useMemo<ModifierCatalog>(
    () => catalogQuery.data ?? { groups: [], links: [] },
    [catalogQuery.data],
  )
  const groups: ModifierGroupWithOptions[] = catalog.groups
  const links: MenuItemModifierGroup[] = catalog.links

  const mutation = useMutation({
    mutationFn: async (task: Task) => {
      await task.run()
    },
    onSuccess: (_data, task) => {
      void queryClient.invalidateQueries({
        queryKey: modifierKeys.all(restaurantId),
      })
      options.onSuccess?.(task.message)
    },
    onError: (error: Error) => options.onError?.(error.message),
  })

  const run = async (task: Task): Promise<boolean> => {
    try {
      await mutation.mutateAsync(task)
      return true
    } catch {
      return false
    }
  }

  const nextLinkOrder = (menuItemId: string): number => {
    const rows = links.filter((link) => link.menu_item_id === menuItemId)
    return rows.length
      ? Math.max(...rows.map((link) => link.display_order)) + 1
      : 0
  }

  return {
    groups,
    links,
    isLoading: catalogQuery.isPending,
    error: catalogQuery.error as Error | null,
    refetch: () => {
      void catalogQuery.refetch()
    },
    isMutating: mutation.isPending,

    createGroup: (input: NewModifierGroupInput) =>
      run({
        message: `Group ${input.name} created`,
        run: () =>
          createModifierGroup({
            restaurant_id: restaurantId,
            name: input.name,
            selection_type: input.selectionType,
            is_required: input.isRequired,
            min_selections: input.minSelections,
            max_selections: input.maxSelections,
            display_order: input.displayOrder,
          }),
      }),

    updateGroup: (id: string, patch: TablesUpdate<"modifier_groups">) =>
      run({
        message: "Group saved",
        run: () => updateModifierGroup(id, patch),
      }),

    deleteGroup: (id: string) =>
      run({
        message: "Group deleted",
        run: () => deleteModifierGroup(id),
      }),

    addModifier: (input: NewModifierInput) =>
      run({
        message: `Option ${input.name} added`,
        run: () =>
          createModifier({
            modifier_group_id: input.groupId,
            name: input.name,
            price_adjustment: input.priceAdjustment,
            is_available: input.isAvailable,
            display_order: input.displayOrder,
          }),
      }),

    updateOption: (id: string, patch: TablesUpdate<"modifiers">) =>
      run({
        message: "Option saved",
        run: () => updateModifier(id, patch),
      }),

    deleteOption: (id: string) =>
      run({
        message: "Option deleted",
        run: () => deleteModifier(id),
      }),

    reorderOptions: (orderedIds: string[]) =>
      run({
        message: "Option order updated",
        run: () =>
          reorderModifiers(
            orderedIds.map((id, display_order) => ({ id, display_order })),
          ),
      }),

    setGroupLink: (
      menuItemId: string,
      groupId: string,
      linked: boolean,
    ) =>
      run({
        message: linked ? "Modifier group attached" : "Modifier group detached",
        run: () =>
          linked
            ? linkModifierGroup(
                menuItemId,
                groupId,
                nextLinkOrder(menuItemId),
              )
            : unlinkModifierGroup(menuItemId, groupId),
      }),
  }
}

export type ModifiersController = ReturnType<typeof useModifiers>

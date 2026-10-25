import { useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createCategory as createCategoryRow,
  createMenuItem,
  deleteCategory as deleteCategoryRow,
  deleteMenuItem,
  deleteMenuItems,
  fetchCategories,
  fetchMenuItems,
  menuKeys,
  reorderMenuItems,
  setMenuItemsAvailability,
  updateCategories,
  updateCategory,
  updateMenuItem,
  updateMenuItems,
} from "@shared/data/menu"
import type { TablesUpdate } from "@shared/lib/database.types"
import { toCategoryVM, toMenuItemVM } from "../mappers"
import type { CategoryVM, MenuItemVM } from "../viewModels"

export type NewMenuItemInput = {
  id: string
  name: string
  categoryId: string
  description: string
  price: number
  imageUrl: string | null
  isAvailable: boolean
  prepTimeMinutes: number
}

type UseMenuOptions = {
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

type Task = {
  run: () => Promise<unknown>
  message: string
}

/**
 * Catalog server state. Every mutation invalidates the restaurant's menu keys
 * and reports its own success/failure message through the supplied callbacks.
 */
export function useMenu(
  restaurantId: string,
  options: UseMenuOptions = {},
) {
  const queryClient = useQueryClient()

  const categoriesQuery = useQuery({
    queryKey: menuKeys.categories(restaurantId),
    queryFn: () => fetchCategories(restaurantId),
    enabled: Boolean(restaurantId),
  })
  const itemsQuery = useQuery({
    queryKey: menuKeys.items(restaurantId),
    queryFn: () => fetchMenuItems(restaurantId),
    enabled: Boolean(restaurantId),
  })

  // Keep derived arrays referentially stable: pages depend on them in effects
  // (selection cleanup), and a fresh array on every render would loop.
  const categoryRows = useMemo(
    () => categoriesQuery.data ?? [],
    [categoriesQuery.data],
  )
  const itemRows = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data])
  const categories: CategoryVM[] = useMemo(
    () => categoryRows.map(toCategoryVM),
    [categoryRows],
  )
  const items: MenuItemVM[] = useMemo(
    () => itemRows.map((row) => toMenuItemVM(row, categoryRows)),
    [categoryRows, itemRows],
  )

  const mutation = useMutation({
    mutationFn: async (task: Task) => {
      await task.run()
    },
    onSuccess: (_data, task) => {
      void queryClient.invalidateQueries({
        queryKey: menuKeys.all(restaurantId),
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

  const nextItemOrder = items.length
    ? Math.max(...items.map((item) => item.displayOrder)) + 1
    : 0
  const nextCategoryOrder = categories.length
    ? Math.max(...categories.map((category) => category.displayOrder)) + 1
    : 0

  return {
    categories,
    items,
    isLoading: categoriesQuery.isPending || itemsQuery.isPending,
    error:
      (categoriesQuery.error as Error | null) ??
      (itemsQuery.error as Error | null),
    refetch: () => {
      void categoriesQuery.refetch()
      void itemsQuery.refetch()
    },
    isMutating: mutation.isPending,

    createItem: (input: NewMenuItemInput) =>
      run({
        message: `Menu item ${input.name} created`,
        run: () =>
          createMenuItem({
            id: input.id,
            restaurant_id: restaurantId,
            category_id: input.categoryId,
            name: input.name,
            description: input.description || null,
            price: input.price,
            image_url: input.imageUrl,
            is_available: input.isAvailable,
            prep_time_minutes: input.prepTimeMinutes,
            display_order: nextItemOrder,
          }),
      }),

    updateItem: (id: string, patch: TablesUpdate<"menu_items">) =>
      run({
        message: "Menu item saved",
        run: () => updateMenuItem(id, patch),
      }),

    deleteItem: (id: string) =>
      run({ message: "Menu item deleted", run: () => deleteMenuItem(id) }),

    deleteItems: (ids: string[]) =>
      run({
        message: `${ids.length} menu items deleted`,
        run: () => deleteMenuItems(ids),
      }),

    setAvailability: (ids: string[], isAvailable: boolean) =>
      run({
        message: `${ids.length} menu items updated`,
        run: () => setMenuItemsAvailability(ids, isAvailable),
      }),

    moveItemsToCategory: (ids: string[], categoryId: string) =>
      run({
        message: `${ids.length} menu items moved`,
        run: () => updateMenuItems(ids, { category_id: categoryId }),
      }),

    reorderItems: (orderedIds: string[]) =>
      run({
        message: "Menu order updated",
        run: () =>
          reorderMenuItems(
            orderedIds.map((id, display_order) => ({ id, display_order })),
          ),
      }),

    createCategory: (name: string) =>
      run({
        message: `Section ${name} created`,
        run: () =>
          createCategoryRow({
            restaurant_id: restaurantId,
            name,
            display_order: nextCategoryOrder,
          }),
      }),

    renameCategory: (id: string, name: string) =>
      run({
        message: "Section renamed",
        run: () => updateCategory(id, { name }),
      }),

    deleteCategory: (id: string) =>
      run({ message: "Section deleted", run: () => deleteCategoryRow(id) }),

    reorderCategories: (orderedIds: string[]) =>
      run({
        message: "Section order updated",
        run: () =>
          updateCategories(
            orderedIds.map((id, display_order) => ({ id, display_order })),
          ),
      }),
  }
}

export type MenuController = ReturnType<typeof useMenu>

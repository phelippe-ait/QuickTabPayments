import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchRestaurant,
  restaurantKeys,
  updateRestaurant,
} from "@shared/data/restaurants"
import { uploadRestaurantAsset, type RestaurantAssetKind } from "@shared/lib/storage"
import type { TablesUpdate } from "@shared/lib/database.types"

type UseRestaurantSettingsOptions = {
  onSaved?: (message: string) => void
  onError?: (message: string) => void
}

/**
 * Server state for `/admin/settings`.
 *
 * `restaurantKeys.detail` is refetched after every write and the membership
 * query is invalidated so the shell name/logo stay in sync.
 */
export function useRestaurantSettings(
  restaurantId: string,
  options: UseRestaurantSettingsOptions = {},
) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: restaurantKeys.detail(restaurantId),
    queryFn: () => fetchRestaurant(restaurantId),
    enabled: Boolean(restaurantId),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: restaurantKeys.detail(restaurantId),
    })
    void queryClient.invalidateQueries({
      queryKey: ["restaurants", "membership"],
    })
  }

  const saveMutation = useMutation({
    mutationFn: (patch: TablesUpdate<"restaurants">) =>
      updateRestaurant(restaurantId, patch),
    onSuccess: () => {
      invalidate()
      options.onSaved?.("Restaurant settings saved")
    },
    onError: (error: Error) => options.onError?.(error.message),
  })

  const uploadMutation = useMutation({
    mutationFn: async ({
      kind,
      file,
    }: {
      kind: RestaurantAssetKind
      file: File
    }) => {
      const url = await uploadRestaurantAsset(restaurantId, kind, file)
      return updateRestaurant(
        restaurantId,
        kind === "logo" ? { logo_url: url } : { cover_image_url: url },
      )
    },
    onSuccess: (_data, variables) => {
      invalidate()
      options.onSaved?.(
        variables.kind === "logo" ? "Logo updated" : "Cover image updated",
      )
    },
    onError: (error: Error) => options.onError?.(error.message),
  })

  return {
    restaurant: query.data ?? null,
    isPending: query.isPending,
    error: query.error,
    refetch: () => void query.refetch(),
    save: (patch: TablesUpdate<"restaurants">) => saveMutation.mutate(patch),
    uploadBranding: (kind: RestaurantAssetKind, file: File) =>
      uploadMutation.mutate({ kind, file }),
    isSaving: saveMutation.isPending,
    isUploading: uploadMutation.isPending,
    saveError: saveMutation.error,
    uploadError: uploadMutation.error,
  }
}

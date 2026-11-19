import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchRestaurantLocation,
  fetchRestaurant,
  restaurantKeys,
  saveRestaurantLocation,
  updateRestaurant,
} from "@shared/data/restaurants"
import {
  removeStoredImage,
  uploadRestaurantAsset,
  type RestaurantAssetKind,
} from "@shared/lib/storage"
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

  const locationQuery = useQuery({
    queryKey: restaurantKeys.location(restaurantId),
    queryFn: () => fetchRestaurantLocation(restaurantId),
    enabled: Boolean(restaurantId),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: restaurantKeys.detail(restaurantId),
    })
    void queryClient.invalidateQueries({
      queryKey: restaurantKeys.location(restaurantId),
    })
    void queryClient.invalidateQueries({
      queryKey: ["restaurants", "membership"],
    })
  }

  const saveMutation = useMutation({
    mutationFn: async (input: {
      patch: TablesUpdate<"restaurants">
      location?: {
        latitude: number
        longitude: number
        label: string
        geofence_enabled: boolean
      } | null
    }) => {
      const restaurant = await updateRestaurant(restaurantId, input.patch)
      if (input.location !== undefined) {
        await saveRestaurantLocation(restaurantId, input.location)
      }
      return restaurant
    },
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
      const previous =
        kind === "logo" ? query.data?.logo_url : query.data?.cover_image_url
      const url = await uploadRestaurantAsset(restaurantId, kind, file)
      const updated = await updateRestaurant(
        restaurantId,
        kind === "logo" ? { logo_url: url } : { cover_image_url: url },
      )
      // Replacing with a different format leaves the old object behind.
      if (previous && previous !== url) await removeStoredImage(previous)
      return updated
    },
    onSuccess: (_data, variables) => {
      invalidate()
      options.onSaved?.(
        variables.kind === "logo" ? "Logo updated" : "Cover image updated",
      )
    },
    onError: (error: Error) => options.onError?.(error.message),
  })

  const removeMutation = useMutation({
    mutationFn: async (kind: RestaurantAssetKind) => {
      const previous =
        kind === "logo" ? query.data?.logo_url : query.data?.cover_image_url
      const updated = await updateRestaurant(
        restaurantId,
        kind === "logo" ? { logo_url: null } : { cover_image_url: null },
      )
      await removeStoredImage(previous)
      return updated
    },
    onSuccess: (_data, kind) => {
      invalidate()
      options.onSaved?.(kind === "logo" ? "Logo removed" : "Cover image removed")
    },
    onError: (error: Error) => options.onError?.(error.message),
  })

  return {
    restaurant: query.data ?? null,
    isPending: query.isPending,
    error: query.error,
    refetch: () => void query.refetch(),
    save: (
      patch: TablesUpdate<"restaurants">,
      location?: {
        latitude: number
        longitude: number
        label: string
        geofence_enabled: boolean
      } | null,
    ) => saveMutation.mutate({ patch, location }),
    location: locationQuery.data ?? null,
    isLocationPending: locationQuery.isPending,
    locationError: locationQuery.error,
    uploadBranding: (kind: RestaurantAssetKind, file: File) =>
      uploadMutation.mutate({ kind, file }),
    removeBranding: (kind: RestaurantAssetKind) => removeMutation.mutate(kind),
    isSaving: saveMutation.isPending,
    isUploading: uploadMutation.isPending,
    isRemoving: removeMutation.isPending,
    saveError: saveMutation.error,
    uploadError: uploadMutation.error,
    removeError: removeMutation.error,
  }
}

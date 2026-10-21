import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createRefund,
  fetchRefundsForOrder,
  refundKeys,
} from "@shared/data/refunds"
import type { TablesInsert } from "@shared/lib/database.types"

type Options = {
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

export function useRefunds(orderId: string) {
  const query = useQuery({
    queryKey: refundKeys.byOrder(orderId),
    queryFn: () => fetchRefundsForOrder(orderId),
    enabled: Boolean(orderId),
  })

  return {
    refunds: query.data ?? [],
    isLoading: query.isPending,
    error: query.error as Error | null,
    refetch: () => void query.refetch(),
  }
}

export function useCreateRefund(orderId: string, options: Options = {}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (input: TablesInsert<"refunds">) => createRefund(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: refundKeys.byOrder(orderId),
      })
      void queryClient.invalidateQueries({ queryKey: ["orders"] })
      options.onSuccess?.("Refund recorded in QuickTab")
    },
    onError: (error: Error) => options.onError?.(error.message),
  })

  return {
    isMutating: mutation.isPending,
    createRefund: async (input: TablesInsert<"refunds">): Promise<boolean> => {
      try {
        await mutation.mutateAsync(input)
        return true
      } catch {
        return false
      }
    },
  }
}

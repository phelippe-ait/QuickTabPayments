import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchRefundsForOrder,
  refundKeys,
  requestStripeRefund,
  type StripeRefundInput,
} from "@shared/data/refunds"

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
    mutationFn: (input: StripeRefundInput) => requestStripeRefund(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: refundKeys.byOrder(orderId),
      })
      void queryClient.invalidateQueries({ queryKey: ["orders"] })
      options.onSuccess?.("Refund sent to Stripe")
    },
    onError: (error: Error) => options.onError?.(error.message),
  })

  return {
    isMutating: mutation.isPending,
    createRefund: async (input: StripeRefundInput): Promise<boolean> => {
      try {
        await mutation.mutateAsync(input)
        return true
      } catch {
        return false
      }
    },
  }
}

import { useQuery } from "@tanstack/react-query"
import { fetchSalesReport, reportKeys } from "@shared/data/reports"

export function useSalesReport(
  restaurantId: string,
  from: string | null,
  to: string | null,
) {
  const query = useQuery({
    queryKey: reportKeys.range(restaurantId, from, to),
    queryFn: () => fetchSalesReport(from, to),
    enabled: Boolean(restaurantId),
    staleTime: 60_000,
  })

  return {
    report: query.data ?? null,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: () => void query.refetch(),
  }
}

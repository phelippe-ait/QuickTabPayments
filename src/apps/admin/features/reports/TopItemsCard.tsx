import type { SalesReportTopItem } from "@shared/data/reports"
import { cn } from "@shared/lib/cn"
import { formatMoney } from "@shared/lib/money"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/ui/shadcn/card"

type TopItemsCardProps = {
  items: SalesReportTopItem[]
  currency: string
}

/** Revenue-led top 10 for the selected report period. */
export function TopItemsCard({ items, currency }: TopItemsCardProps) {
  const ranked = [...items].sort(
    (a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top items</CardTitle>
        <CardDescription>Highest revenue in this period.</CardDescription>
      </CardHeader>
      <CardContent>
        {ranked.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-sm text-muted">
            No items sold in this period.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Top items ranked by revenue
            </caption>
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
                <th scope="col" className="w-12 py-2 pr-2 font-bold">
                  Rank
                </th>
                <th scope="col" className="py-2 pr-2 font-bold">
                  Item
                </th>
                <th scope="col" className="py-2 pr-2 text-right font-bold">
                  Qty
                </th>
                <th scope="col" className="py-2 text-right font-bold">
                  Revenue
                </th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((item, index) => (
                <tr
                  key={item.name}
                  className="border-b border-line-soft last:border-0"
                >
                  <td className="py-2.5 pr-2">
                    <RankBadge rank={index + 1} />
                  </td>
                  <td className="py-2.5 pr-2 text-ink">{item.name}</td>
                  <td className="py-2.5 pr-2 text-right tabular-nums text-ink-mid">
                    {item.quantity.toLocaleString("en-AU")}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-ink">
                    {formatMoney(item.revenue, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}

function RankBadge({ rank }: { rank: number }) {
  const isTopThree = rank <= 3

  return (
    <span
      aria-label={`Rank ${rank}`}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-full text-xs font-bold tabular-nums",
        isTopThree ? "bg-berry-soft text-berry-strong" : "text-muted",
      )}
    >
      {rank}
    </span>
  )
}

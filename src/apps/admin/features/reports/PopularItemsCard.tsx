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

type PopularItemsCardProps = {
  items: SalesReportTopItem[]
  currency: string
}

/**
 * Quantity-led operational view: which items the kitchen should prep most of.
 * The payload comes from the same report query as every other card.
 */
export function PopularItemsCard({ items, currency }: PopularItemsCardProps) {
  const ranked = [...items].sort(
    (a, b) =>
      b.quantity - a.quantity ||
      b.revenue - a.revenue ||
      a.name.localeCompare(b.name),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Popular items</CardTitle>
        <CardDescription>
          Top 10 by quantity sold — use this for prep planning.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {ranked.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-sm text-muted">
            No items sold in this period.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Popular items ranked by quantity sold
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
                  Quantity
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
                    <span
                      aria-label={`Rank ${index + 1}`}
                      className={cn(
                        "inline-flex size-7 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                        index < 3
                          ? "bg-berry-soft text-berry-strong"
                          : "text-muted",
                      )}
                    >
                      {index + 1}
                    </span>
                  </td>
                  <td className="py-2.5 pr-2 text-ink">{item.name}</td>
                  <td className="py-2.5 pr-2 text-right tabular-nums font-bold text-ink">
                    {item.quantity.toLocaleString("en-AU")}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-ink-mid">
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

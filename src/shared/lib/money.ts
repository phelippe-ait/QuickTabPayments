/**
 * Money contract: the database stores numbers, the UI formats them.
 * Never parse a formatted currency string back into a number.
 */
export function formatMoney(
  amount: number,
  currency: string,
  locale?: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount)
}

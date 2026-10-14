export function getTableUrl(tableNumber: string) {
  const tableUrl = new URL(window.location.origin)
  tableUrl.searchParams.set("table", tableNumber)
  return tableUrl.toString()
}

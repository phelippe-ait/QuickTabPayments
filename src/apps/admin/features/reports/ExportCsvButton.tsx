import { useId, useState } from "react"
import type { SalesReport } from "@shared/data/reports"
import { usePlan } from "@shared/plans/usePlan"
import { Icon } from "@shared/ui/Icon"
import { Badge } from "@shared/ui/shadcn/badge"
import { Button } from "@shared/ui/shadcn/button"
import { buildReportCsv, downloadCsv, reportCsvFilename } from "./csv"

type ExportCsvButtonProps = {
  report: SalesReport | null
  restaurantName: string
  /** True while the report query has no data yet. */
  loading?: boolean
}

/**
 * Downloads the currently-loaded sales report. Standard+ plans get an enabled
 * button; lower plans see a disabled control with the upgrade hint.
 */
export function ExportCsvButton({
  report,
  restaurantName,
  loading = false,
}: ExportCsvButtonProps) {
  const { has } = usePlan()
  const hintId = useId()
  const [status, setStatus] = useState("")
  const canExport = has("csv_export")
  const disabled = !canExport || loading || !report

  const handleExport = () => {
    if (!canExport || !report) return

    const filename = reportCsvFilename(report)
    downloadCsv(
      buildReportCsv(report, { restaurantName }),
      filename,
    )
    setStatus(`CSV downloaded: ${filename}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="inline-flex"
        title={canExport ? undefined : "Standard plan or higher"}
      >
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled}
          aria-label="Export report as CSV"
          aria-describedby={canExport ? undefined : hintId}
          onClick={handleExport}
        >
          <Icon name="download" size={15} />
          Export CSV
        </Button>
      </span>
      {!canExport && (
        <Badge id={hintId} variant="warning">
          Standard plan or higher
        </Badge>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  )
}

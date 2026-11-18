import { useId, useState, type ReactNode } from "react"
import { Button } from "@shared/ui/shadcn/button"
import {
  PERIOD_PRESET_LABELS,
  getCustomPeriod,
  getPeriodRange,
  validateCustomRange,
  type FixedPeriodPreset,
  type PeriodPreset,
  type ReportPeriod,
} from "./period"

const FIXED_PRESETS: FixedPeriodPreset[] = ["today", "7d", "30d"]

const inputClassName =
  "min-h-9 rounded-[9px] border border-line bg-white px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-berry"

type ReportPeriodSelectorProps = {
  timezone: string
  onChange: (period: ReportPeriod) => void
  /** Injectable clock for tests; defaults to the real current time. */
  now?: Date
  /** Optional controls rendered beside the preset row (for example, export). */
  actions?: ReactNode
}

/**
 * Preset/custom period picker. Selection is local component state; the page
 * receives each applied range through `onChange`.
 */
export function ReportPeriodSelector({
  timezone,
  onChange,
  now,
  actions,
}: ReportPeriodSelectorProps) {
  const errorId = useId()
  const [initial] = useState(() =>
    getPeriodRange("30d", now ?? new Date(), timezone),
  )
  const [preset, setPreset] = useState<PeriodPreset>("30d")
  const [customFrom, setCustomFrom] = useState(initial.fromDate)
  const [customTo, setCustomTo] = useState(initial.toDate)

  const currentTime = () => now ?? new Date()
  const customError =
    preset === "custom" ? validateCustomRange(customFrom, customTo) : null

  const selectPreset = (next: FixedPeriodPreset) => {
    const period = getPeriodRange(next, currentTime(), timezone)
    setPreset(next)
    setCustomFrom(period.fromDate)
    setCustomTo(period.toDate)
    onChange(period)
  }

  const applyCustom = () => {
    if (validateCustomRange(customFrom, customTo)) return
    onChange(getCustomPeriod(customFrom, customTo, timezone))
  }

  return (
    <section className="mt-6 flex flex-col gap-4" aria-label="Report period">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Period presets"
        >
          {FIXED_PRESETS.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={preset === value ? "default" : "secondary"}
              aria-pressed={preset === value}
              onClick={() => selectPreset(value)}
            >
              {PERIOD_PRESET_LABELS[value]}
            </Button>
          ))}
          <Button
            size="sm"
            variant={preset === "custom" ? "default" : "secondary"}
            aria-pressed={preset === "custom"}
            onClick={() => setPreset("custom")}
          >
            {PERIOD_PRESET_LABELS.custom}
          </Button>
        </div>
        {actions}
      </div>

      {preset === "custom" && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-bold text-ink-mid">
            From
            <input
              type="date"
              className={inputClassName}
              value={customFrom}
              max={customTo || undefined}
              aria-invalid={Boolean(customError)}
              aria-describedby={customError ? errorId : undefined}
              onChange={(event) => setCustomFrom(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-ink-mid">
            To
            <input
              type="date"
              className={inputClassName}
              value={customTo}
              min={customFrom || undefined}
              aria-invalid={Boolean(customError)}
              aria-describedby={customError ? errorId : undefined}
              onChange={(event) => setCustomTo(event.target.value)}
            />
          </label>
          <Button size="sm" onClick={applyCustom} disabled={Boolean(customError)}>
            Apply
          </Button>
          {customError && (
            <p
              id={errorId}
              role="alert"
              aria-live="polite"
              className="pb-2 text-xs text-danger"
            >
              {customError}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

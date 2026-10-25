/* eslint-disable react-refresh/only-export-components -- provider + hook share a file */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { resolveInitialQrContext } from "../../data/qrContext"
import type { QrContext, QrErrorCode } from "../../types"

type QrState = {
  status: "loading" | "ready" | "error"
  context: QrContext | null
  error: QrErrorCode | null
}

type QrContextValue = QrState & {
  retry: () => void
}

const QrProviderContext = createContext<QrContextValue | null>(null)

/**
 * Resolves `?r=<slug>&t=<table token>` once on boot and holds the restaurant +
 * table for the whole session. Resolved source is also persisted so an OAuth
 * redirect (which drops the query string) can restore the same table.
 */
export function QrProvider({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<QrState>({
    status: "loading",
    context: null,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const result = await resolveInitialQrContext()
        if (cancelled) return
        if (result.ok) {
          setState({ status: "ready", context: result.context, error: null })
        } else {
          setState({ status: "error", context: null, error: result.error })
        }
      } catch (error) {
        if (cancelled) return
        console.error("Could not resolve QR context", error)
        setState({ status: "error", context: null, error: "unknown" })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [attempt])

  const retry = useCallback(() => {
    setState({ status: "loading", context: null, error: null })
    setAttempt((current) => current + 1)
  }, [])

  const value = useMemo<QrContextValue>(
    () => ({ ...state, retry }),
    [state, retry],
  )

  return (
    <QrProviderContext.Provider value={value}>
      {children}
    </QrProviderContext.Provider>
  )
}

export function useQrContext(): QrContextValue {
  const value = useContext(QrProviderContext)
  if (!value) {
    throw new Error("useQrContext must be used inside QrProvider")
  }
  return value
}

import { useEffect, useRef, useState } from "react"

export type ToastTone = "success" | "error"

export type AdminToast = {
  message: string
  tone: ToastTone
}

export function useAdminToast() {
  const [toast, setToast] = useState<AdminToast | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (message: string, tone: ToastTone = "success") => {
    setToast({ message, tone })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  return { toast, showToast }
}

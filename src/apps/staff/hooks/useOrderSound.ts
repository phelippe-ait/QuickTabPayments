import { useCallback, useEffect, useRef, useState } from "react"

/**
 * localStorage key for the kitchen mute preference. `"true"` means muted.
 * Default (missing key) is unmuted.
 */
export const KITCHEN_MUTED_STORAGE_KEY = "qt.kitchen.muted"

export type OrderSoundControls = {
  enabled: boolean
  unlocked: boolean
  toggle: () => void
  prime: () => void
  play: () => boolean
}

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(KITCHEN_MUTED_STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null
  if (typeof AudioContext !== "undefined") return AudioContext
  const legacy = window as unknown as {
    webkitAudioContext?: typeof AudioContext
  }
  return legacy.webkitAudioContext ?? null
}

/**
 * A short two-note chime for new kitchen orders.
 *
 * Uses the Web Audio API instead of an audio file so no binary asset needs to
 * be committed. Browsers keep a fresh `AudioContext` suspended until a user
 * gesture, so `prime()` is called from the first pointer/key interaction and
 * `play()` no-ops until the context is unlocked.
 */
export function useOrderSound(): OrderSoundControls {
  const [enabled, setEnabled] = useState(() => !readMuted())
  const [unlocked, setUnlocked] = useState(false)

  const contextRef = useRef<AudioContext | null>(null)
  const enabledRef = useRef(enabled)
  const unlockedRef = useRef(false)

  const getContext = useCallback((): AudioContext | null => {
    if (contextRef.current) return contextRef.current
    const AudioContextCtor = getAudioContextConstructor()
    if (!AudioContextCtor) return null
    try {
      contextRef.current = new AudioContextCtor()
      return contextRef.current
    } catch (error) {
      console.error("Could not start kitchen audio:", error)
      return null
    }
  }, [])

  const prime = useCallback(() => {
    const context = getContext()
    if (!context) return

    unlockedRef.current = true
    setUnlocked(true)

    if (context.state === "suspended") {
      void context.resume().catch((error: unknown) => {
        unlockedRef.current = false
        setUnlocked(false)
        console.error("Could not unlock kitchen audio:", error)
      })
    }
  }, [getContext])

  const play = useCallback((): boolean => {
    if (!enabledRef.current || !unlockedRef.current) return false

    const context = getContext()
    if (!context || context.state !== "running") return false

    try {
      const now = context.currentTime
      const oscillator = context.createOscillator()
      const gain = context.createGain()

      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(880, now)
      oscillator.frequency.setValueAtTime(1174.66, now + 0.12)

      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5)

      oscillator.connect(gain)
      gain.connect(context.destination)

      oscillator.onended = () => {
        oscillator.disconnect()
        gain.disconnect()
      }

      oscillator.start(now)
      oscillator.stop(now + 0.52)
      return true
    } catch (error) {
      console.error("Could not play kitchen notification:", error)
      return false
    }
  }, [getContext])

  const toggle = useCallback(() => {
    setEnabled((current) => {
      const next = !current
      enabledRef.current = next
      try {
        window.localStorage.setItem(
          KITCHEN_MUTED_STORAGE_KEY,
          next ? "false" : "true",
        )
      } catch {
        // Storage can be unavailable (private mode); the toggle still works
        // for this session.
      }
      return next
    })
  }, [])

  // Autoplay policies only allow audio after a user gesture. Prime once on the
  // first pointer/key interaction, then drop both listeners.
  useEffect(() => {
    const unlock = () => {
      prime()
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }

    window.addEventListener("pointerdown", unlock)
    window.addEventListener("keydown", unlock)

    return () => {
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }
  }, [prime])

  // Release the audio hardware when the kitchen workspace unmounts.
  useEffect(() => {
    return () => {
      const context = contextRef.current
      contextRef.current = null
      if (context && context.state !== "closed") {
        void context.close().catch((error: unknown) => {
          console.error("Could not close kitchen audio:", error)
        })
      }
    }
  }, [])

  return { enabled, unlocked, toggle, prime, play }
}

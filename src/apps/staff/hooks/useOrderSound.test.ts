import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import {
  KITCHEN_MUTED_STORAGE_KEY,
  useOrderSound,
} from "./useOrderSound"

type MockParam = {
  setValueAtTime: ReturnType<typeof vi.fn>
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>
}

type MockOscillator = {
  type: OscillatorType
  frequency: MockParam
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  onended: (() => void) | null
}

type MockGain = {
  gain: MockParam
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

type MockContext = {
  state: AudioContextState
  currentTime: number
  destination: unknown
  resume: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  createOscillator: ReturnType<typeof vi.fn>
  createGain: ReturnType<typeof vi.fn>
}

function installAudioContextMock() {
  const oscillator: MockOscillator = {
    type: "sine",
    frequency: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
  }

  const gain: MockGain = {
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }

  const context: MockContext = {
    state: "suspended",
    currentTime: 0,
    destination: {},
    resume: vi.fn(),
    close: vi.fn(),
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => gain),
  }
  context.resume.mockImplementation(async () => {
    context.state = "running"
  })
  context.close.mockImplementation(async () => {
    context.state = "closed"
  })

  const AudioContextMock = vi.fn(function AudioContextMockImpl() {
    return context
  })
  vi.stubGlobal("AudioContext", AudioContextMock)

  return { AudioContextMock, context, oscillator, gain }
}

describe("useOrderSound", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.localStorage.clear()
  })

  it("no-ops play() when muted", () => {
    window.localStorage.setItem(KITCHEN_MUTED_STORAGE_KEY, "true")
    const { context } = installAudioContextMock()
    const { result } = renderHook(() => useOrderSound())

    act(() => result.current.prime())

    expect(result.current.enabled).toBe(false)
    expect(result.current.play()).toBe(false)
    expect(context.createOscillator).not.toHaveBeenCalled()
  })

  it("no-ops play() until the context is unlocked", () => {
    const { context } = installAudioContextMock()
    const { result } = renderHook(() => useOrderSound())

    expect(result.current.unlocked).toBe(false)
    expect(result.current.play()).toBe(false)
    expect(context.createOscillator).not.toHaveBeenCalled()
  })

  it("persists the mute preference and rehydrates it", () => {
    installAudioContextMock()
    const first = renderHook(() => useOrderSound())

    act(() => first.result.current.toggle())
    expect(first.result.current.enabled).toBe(false)
    expect(window.localStorage.getItem(KITCHEN_MUTED_STORAGE_KEY)).toBe("true")
    first.unmount()

    const second = renderHook(() => useOrderSound())
    expect(second.result.current.enabled).toBe(false)

    act(() => second.result.current.toggle())
    expect(second.result.current.enabled).toBe(true)
    expect(window.localStorage.getItem(KITCHEN_MUTED_STORAGE_KEY)).toBe("false")
  })

  it("prime() marks the context unlocked and resumes it", () => {
    const { context } = installAudioContextMock()
    const { result } = renderHook(() => useOrderSound())

    act(() => result.current.prime())

    expect(result.current.unlocked).toBe(true)
    expect(context.resume).toHaveBeenCalledTimes(1)
  })

  it("unlocks on the first pointer or key gesture", () => {
    const { context } = installAudioContextMock()
    const { result } = renderHook(() => useOrderSound())

    act(() => {
      window.dispatchEvent(new Event("keydown"))
    })

    expect(result.current.unlocked).toBe(true)
    expect(context.resume).toHaveBeenCalledTimes(1)
  })

  it("plays the chime when enabled and unlocked", () => {
    const { context, oscillator, gain } = installAudioContextMock()
    const { result } = renderHook(() => useOrderSound())

    act(() => result.current.prime())
    const played = result.current.play()

    expect(played).toBe(true)
    expect(context.createOscillator).toHaveBeenCalledTimes(1)
    expect(context.createGain).toHaveBeenCalledTimes(1)
    expect(oscillator.start).toHaveBeenCalledTimes(1)
    expect(oscillator.stop).toHaveBeenCalledTimes(1)
    expect(gain.connect).toHaveBeenCalledWith(context.destination)
  })

  it("closes the audio context on unmount", () => {
    const { context } = installAudioContextMock()
    const { result, unmount } = renderHook(() => useOrderSound())

    act(() => result.current.prime())
    unmount()

    expect(context.close).toHaveBeenCalledTimes(1)
  })
})

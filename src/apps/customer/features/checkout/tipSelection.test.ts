import { describe, expect, it } from "vitest";
import {
  customTipError,
  initialTipState,
  parseCustomTip,
  selectCustom,
  selectPreset,
  tipLabel,
  tipPreviewAmount,
  tipSelectionPayload,
} from "./tipSelection";

describe("tip selection state", () => {
  it("defaults to no tip", () => {
    expect(initialTipState).toEqual({
      mode: "preset",
      percent: 0,
      custom: "",
    });
    expect(tipSelectionPayload(initialTipState)).toBeNull();
    expect(tipPreviewAmount(initialTipState, 23)).toBe(0);
  });

  it("maps a percentage preset to a percent payload", () => {
    const state = selectPreset(initialTipState, 10);
    expect(tipSelectionPayload(state)).toEqual({ type: "percent", value: 10 });
    expect(tipLabel(state)).toBe("Tip (10%)");
    expect(tipPreviewAmount(state, 23)).toBe(2.3);
  });

  it("computes the 15% preset with the shared rounding", () => {
    const state = selectPreset(initialTipState, 15);
    expect(tipPreviewAmount(state, 42.55)).toBe(6.38);
  });

  it("keeps a typed custom amount when switching between presets and custom", () => {
    let state = selectPreset(initialTipState, 10);
    state = { ...selectCustom(state), custom: "5" };
    expect(tipSelectionPayload(state)).toEqual({ type: "fixed", value: 5 });
    expect(tipLabel(state)).toBe("Tip");
    expect(tipPreviewAmount(state, 23)).toBe(5);

    state = selectPreset(state, 0);
    expect(tipSelectionPayload(state)).toBeNull();

    state = selectCustom(state);
    expect(state.custom).toBe("5");
    expect(tipSelectionPayload(state)).toEqual({ type: "fixed", value: 5 });
  });

  it("treats a zero custom amount as no tip", () => {
    const state = { ...selectCustom(initialTipState), custom: "0" };
    expect(tipSelectionPayload(state)).toBeNull();
    expect(tipPreviewAmount(state, 23)).toBe(0);
  });

  it("does not throw for an invalid custom amount while previewing", () => {
    const state = { ...selectCustom(initialTipState), custom: "600" };
    expect(tipSelectionPayload(state)).toBeNull();
    expect(tipPreviewAmount(state, 23)).toBe(0);
    expect(customTipError(state)).toMatch(/500/);
  });
});

describe("parseCustomTip", () => {
  it("accepts amounts with up to two decimals", () => {
    expect(parseCustomTip("5")).toEqual({ ok: true, value: 5 });
    expect(parseCustomTip("5.5")).toEqual({ ok: true, value: 5.5 });
    expect(parseCustomTip(" 5.55 ")).toEqual({ ok: true, value: 5.55 });
    expect(parseCustomTip(".5")).toEqual({ ok: true, value: 0.5 });
    expect(parseCustomTip("500")).toEqual({ ok: true, value: 500 });
  });

  it("rejects empty, non-numeric and over-precise input", () => {
    expect(parseCustomTip("")).toMatchObject({ ok: false });
    expect(parseCustomTip("abc")).toMatchObject({ ok: false });
    expect(parseCustomTip("5.555")).toMatchObject({ ok: false });
    expect(parseCustomTip(".")).toMatchObject({ ok: false });
  });

  it("rejects negative amounts and amounts over the cap", () => {
    expect(parseCustomTip("-5")).toMatchObject({
      ok: false,
      error: "Tip can't be negative.",
    });
    expect(parseCustomTip("500.01")).toMatchObject({
      ok: false,
      error: "Tip can't be more than $500.",
    });
  });
});

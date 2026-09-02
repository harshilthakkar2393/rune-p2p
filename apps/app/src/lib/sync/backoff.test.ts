import { describe, expect, test } from "bun:test";

import {
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
  canAttempt,
  initialBackoff,
  recordAttempt,
  resetBackoff,
  type BackoffState,
} from "@/lib/sync/backoff";

describe("backoff", () => {
  test("initialBackoff() allows an attempt immediately", () => {
    const state = initialBackoff();
    expect(state.attempt).toBe(0);
    expect(state.nextAllowedAt).toBe(0);
    expect(canAttempt(state, 0)).toBe(true);
    expect(canAttempt(state, Date.now())).toBe(true);
  });

  test("after one attempt at t=0, the next is allowed at 5000, not 4999", () => {
    const state = recordAttempt(initialBackoff(), 0);
    expect(canAttempt(state, 4_999)).toBe(false);
    expect(canAttempt(state, 5_000)).toBe(true);
  });

  test("delay sequence doubles: 5s, 10s, 20s, 40s...", () => {
    let state = initialBackoff();
    let now = 0;
    const delays: number[] = [];
    for (let i = 0; i < 4; i++) {
      state = recordAttempt(state, now);
      delays.push(state.nextAllowedAt - now);
      now = state.nextAllowedAt;
    }
    expect(delays).toEqual([
      BACKOFF_BASE_MS,
      BACKOFF_BASE_MS * 2,
      BACKOFF_BASE_MS * 4,
      BACKOFF_BASE_MS * 8,
    ]);
  });

  test("delay caps at BACKOFF_MAX_MS", () => {
    let state = initialBackoff();
    let now = 0;
    for (let i = 0; i < 10; i++) {
      state = recordAttempt(state, now);
      now = state.nextAllowedAt;
    }
    const capped = recordAttempt(state, now);
    expect(capped.nextAllowedAt - now).toBe(BACKOFF_MAX_MS);
  });

  test("resetBackoff() allows an attempt immediately again", () => {
    let state = initialBackoff();
    state = recordAttempt(state, 0);
    state = recordAttempt(state, 5_000);
    const reset = resetBackoff();
    expect(reset).toEqual(initialBackoff());
    expect(canAttempt(reset, 0)).toBe(true);
  });

  test("recordAttempt() and canAttempt() never mutate their input state", () => {
    const state: BackoffState = { attempt: 2, nextAllowedAt: 20_000 };
    const snapshot = { ...state };
    canAttempt(state, 25_000);
    expect(state).toEqual(snapshot);
    recordAttempt(state, 25_000);
    expect(state).toEqual(snapshot);
  });
});

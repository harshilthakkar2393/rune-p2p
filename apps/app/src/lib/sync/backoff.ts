/**
 * Pure reconnect backoff. No timers — callers pass `now` and decide when to
 * check `canAttempt` (e.g. on foreground/online events).
 */

export type BackoffState = {
  attempt: number;
  nextAllowedAt: number;
};

export const BACKOFF_BASE_MS = 5_000;
export const BACKOFF_MAX_MS = 5 * 60_000;

export function initialBackoff(): BackoffState {
  return { attempt: 0, nextAllowedAt: 0 };
}

export function canAttempt(state: BackoffState, now: number): boolean {
  return now >= state.nextAllowedAt;
}

export function recordAttempt(state: BackoffState, now: number): BackoffState {
  const attempt = state.attempt + 1;
  const delay = Math.min(BACKOFF_BASE_MS * 2 ** state.attempt, BACKOFF_MAX_MS);
  return { attempt, nextAllowedAt: now + delay };
}

export function resetBackoff(): BackoffState {
  return initialBackoff();
}

import { describe, expect, test } from "bun:test";

import {
  getPwaStatus,
  isStandalone,
  promptInstall,
  requestPersistentStorage,
  setPwaStatus,
} from "@/lib/pwa";

describe("isStandalone", () => {
  test("true when matchMedia(display-mode: standalone) matches", () => {
    const win = { matchMedia: (_query: string) => ({ matches: true }) };
    expect(isStandalone(win)).toBe(true);
  });

  test("true when navigator.standalone === true", () => {
    const win = { navigator: { standalone: true } };
    expect(isStandalone(win)).toBe(true);
  });

  test("false when neither signal is set", () => {
    const win = {
      matchMedia: (_query: string) => ({ matches: false }),
      navigator: { standalone: false },
    };
    expect(isStandalone(win)).toBe(false);
  });

  test("false when win has neither matchMedia nor navigator", () => {
    expect(isStandalone({})).toBe(false);
  });
});

describe("requestPersistentStorage", () => {
  test("no storage API → resolves null and sets status persisted: null", async () => {
    setPwaStatus({ persisted: true });
    const result = await requestPersistentStorage(null);
    expect(result).toBeNull();
    expect(getPwaStatus().persisted).toBeNull();
  });

  test("already persisted → resolves true without calling persist", async () => {
    let persistCalled = false;
    const storage = {
      persisted: () => Promise.resolve(true),
      persist: () => {
        persistCalled = true;
        return Promise.resolve(true);
      },
    };
    const result = await requestPersistentStorage(storage);
    expect(result).toBe(true);
    expect(persistCalled).toBe(false);
    expect(getPwaStatus().persisted).toBe(true);
  });

  test("not persisted → calls persist and returns its result", async () => {
    const storage = {
      persisted: () => Promise.resolve(false),
      persist: () => Promise.resolve(true),
    };
    const result = await requestPersistentStorage(storage);
    expect(result).toBe(true);
    expect(getPwaStatus().persisted).toBe(true);
  });

  test("persist rejecting → resolves null, never throws", async () => {
    const storage = {
      persisted: () => Promise.resolve(false),
      persist: () => Promise.reject(new Error("nope")),
    };
    await expect(requestPersistentStorage(storage)).resolves.toBeNull();
  });
});

describe("promptInstall", () => {
  test("with no captured event → resolves false", async () => {
    const result = await promptInstall();
    expect(result).toBe(false);
  });
});

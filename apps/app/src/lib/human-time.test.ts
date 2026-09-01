import { describe, expect, test } from "bun:test";
import { humanTime } from "@/lib/human-time";

const NOW = new Date("2026-09-01T12:00:00").getTime();
const min = 60_000;

describe("humanTime", () => {
  test("just now under a minute", () => {
    expect(humanTime(NOW - 30_000, NOW)).toBe("just now");
  });
  test("minutes", () => {
    expect(humanTime(NOW - 4 * min, NOW)).toBe("4 min ago");
  });
  test("hours", () => {
    expect(humanTime(NOW - 3 * 60 * min, NOW)).toBe("3h ago");
  });
  test("yesterday", () => {
    expect(humanTime(NOW - 26 * 60 * min, NOW)).toBe("yesterday");
  });
  test("days under a week", () => {
    expect(humanTime(NOW - 3 * 24 * 60 * min, NOW)).toBe("3d ago");
  });
  test("older gets short date without year", () => {
    expect(humanTime(new Date("2026-08-10T09:00:00").getTime(), NOW)).toBe("Aug 10");
  });
  test("previous year includes year", () => {
    expect(humanTime(new Date("2025-12-20T09:00:00").getTime(), NOW)).toContain("2025");
  });
});

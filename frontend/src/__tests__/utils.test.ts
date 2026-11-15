import { describe, expect, it } from "vitest";
import { cn, formatDate, formatNumber, getPriorityColor } from "@/lib/utils";

describe("GTMFlow frontend utility helpers", () => {
  it("merges Tailwind class names cleanly via cn()", () => {
    expect(cn("px-2 py-1", "px-4", false && "hidden")).toBe("py-1 px-4");
  });

  it("formats numbers and handles missing values gracefully", () => {
    expect(formatNumber(null)).toBe("-");
    expect(formatNumber(undefined)).toBe("-");
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(1250)).toBe("1,250");
  });

  it("formats ISO dates and falls back cleanly on invalid inputs", () => {
    expect(formatDate(null)).toBe("-");
    expect(formatDate(undefined)).toBe("-");
    const formatted = formatDate("2026-11-10T10:30:00Z");
    expect(formatted).toContain("Nov");
    expect(formatted).toContain("2026");
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });

  it("maps account priority tiers to consistent color tokens", () => {
    const high = getPriorityColor("high");
    expect(high.badge).toContain("emerald");
    expect(high.bg).toBe("bg-emerald-500");

    const medium = getPriorityColor("MEDIUM");
    expect(medium.badge).toContain("amber");
    expect(medium.text).toBe("text-amber-700");

    const low = getPriorityColor(null);
    expect(low.badge).toContain("slate");
  });
});

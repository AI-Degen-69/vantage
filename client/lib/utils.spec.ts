import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn function", () => {
  it("should merge classes correctly", () => {
    expect(cn("text-chart-negative", "bg-chart-blue")).toBe("text-chart-negative bg-chart-blue");
  });

  it("should handle conditional classes", () => {
    const isActive = true;
    expect(cn("base-class", isActive && "active-class")).toBe(
      "base-class active-class",
    );
  });

  it("should handle false and null conditions", () => {
    const isActive = false;
    expect(cn("base-class", isActive && "active-class", null)).toBe(
      "base-class",
    );
  });

  it("should merge tailwind classes properly", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("should work with object notation", () => {
    expect(cn("base", { conditional: true, "not-included": false })).toBe(
      "base conditional",
    );
  });
});

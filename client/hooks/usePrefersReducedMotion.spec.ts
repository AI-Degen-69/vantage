// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  prefersReducedMotionFrom,
  REDUCED_MOTION_QUERY,
} from "./usePrefersReducedMotion";

describe("prefersReducedMotionFrom", () => {
  it("returns false when matchMedia is unavailable (SSR / node)", () => {
    expect(prefersReducedMotionFrom(undefined)).toBe(false);
  });

  it("queries the standard reduced-motion media query", () => {
    let queried = "";
    prefersReducedMotionFrom((query) => {
      queried = query;
      return { matches: false };
    });
    expect(queried).toBe(REDUCED_MOTION_QUERY);
  });

  it("returns the matchMedia matches flag", () => {
    expect(prefersReducedMotionFrom(() => ({ matches: true }))).toBe(true);
    expect(prefersReducedMotionFrom(() => ({ matches: false }))).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import {
  lerpScale,
  lerpRotation,
  cubicBezierEase,
} from "@/lib/tween";

describe("lerpScale", () => {
  it("interpolates linearly between start and end", () => {
    expect(lerpScale(1, 3, 0)).toBe(1);
    expect(lerpScale(1, 3, 1)).toBe(3);
    expect(lerpScale(1, 3, 0.5)).toBe(2);
  });
});

describe("lerpRotation", () => {
  it("interpolates longitude and latitude linearly for short arcs", () => {
    const r = lerpRotation([0, 0], [60, 30], 0.5);
    expect(r[0]).toBeCloseTo(30, 5);
    expect(r[1]).toBeCloseTo(15, 5);
  });

  it("takes the short way around when |delta lon| > 180", () => {
    // start lon = 170, end lon = -170. Linear would go -340°; short arc is +20°.
    const r = lerpRotation([170, 0], [-170, 0], 0.5);
    // Midpoint should be at ±180 (wraps to itself); value in [-180, 180].
    const wrapped = ((r[0] + 540) % 360) - 180;
    expect(Math.abs(wrapped)).toBeCloseTo(180, 1);
  });

  it("returns start at t=0 and end at t=1", () => {
    const s: [number, number] = [10, 20];
    const e: [number, number] = [-100, -40];
    const at0 = lerpRotation(s, e, 0);
    const at1 = lerpRotation(s, e, 1);
    expect(at0[0]).toBeCloseTo(s[0], 5);
    expect(at0[1]).toBeCloseTo(s[1], 5);
    expect(at1[0]).toBeCloseTo(e[0], 5);
    expect(at1[1]).toBeCloseTo(e[1], 5);
  });
});

describe("cubicBezierEase", () => {
  it("returns 0 at t=0 and 1 at t=1", () => {
    // Using the site's standard 'smooth decel' curve (0.2, 0, 0, 1).
    expect(cubicBezierEase(0.2, 0, 0, 1)(0)).toBeCloseTo(0, 5);
    expect(cubicBezierEase(0.2, 0, 0, 1)(1)).toBeCloseTo(1, 5);
  });

  it("is monotonic on [0, 1]", () => {
    const ease = cubicBezierEase(0.2, 0, 0, 1);
    let prev = 0;
    for (let i = 1; i <= 10; i++) {
      const v = ease(i / 10);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

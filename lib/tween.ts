export function lerpScale(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function lerpRotation(
  from: [number, number],
  to: [number, number],
  t: number,
): [number, number] {
  let dLon = to[0] - from[0];
  // Short-arc: if the straight-line delta is more than half the globe,
  // wrap the other way so a fly-to from 170° to -170° travels 20°, not 340°.
  if (dLon > 180) dLon -= 360;
  else if (dLon < -180) dLon += 360;
  const lon = from[0] + dLon * t;
  const lat = from[1] + (to[1] - from[1]) * t;
  return [lon, lat];
}

/**
 * Returns a function that evaluates the y coordinate of a CSS-style cubic
 * Bezier given an x in [0, 1]. Used to ease rAF `t` values so fly-to
 * animations match the site's `cubic-bezier(0.2, 0, 0, 1)` curve.
 *
 * Implementation: Newton-Raphson to solve x(t) = input, then evaluate y(t).
 */
export function cubicBezierEase(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (x: number) => number {
  const bezierX = (t: number) =>
    3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const bezierY = (t: number) =>
    3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  const bezierXDerivative = (t: number) =>
    3 * (1 - t) * (1 - t) * x1 +
    6 * (1 - t) * t * (x2 - x1) +
    3 * t * t * (1 - x2);

  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const currentX = bezierX(t) - x;
      const derivative = bezierXDerivative(t);
      if (Math.abs(currentX) < 1e-5) break;
      if (Math.abs(derivative) < 1e-6) break;
      t -= currentX / derivative;
    }
    return bezierY(t);
  };
}

export type ContactVector = readonly [x: number, y: number, z: number];

export interface ContactSegment {
  start: ContactVector;
  end: ContactVector;
}

export interface CapsuleContactProxy {
  axis: ContactSegment;
  radiusMeters: number;
}

export interface BladeCapsuleContactMeasurement {
  schema: "cow.blade-capsule-contact.v1";
  bladeClosestWorld: ContactVector;
  targetClosestWorld: ContactVector;
  blade01: number;
  targetAxis01: number;
  centerlineMeters: number;
  separationMeters: number;
  standoffMeters: number;
  penetrationMeters: number;
  exteriorContactPoints: 0 | 1;
  closestFeature: "blade-start" | "blade-interior" | "blade-end";
}

const EPSILON = 1e-12;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function rounded(value: number): number {
  const result = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(result, -0) ? 0 : result;
}

function subtract(from: ContactVector, to: ContactVector): ContactVector {
  return [from[0] - to[0], from[1] - to[1], from[2] - to[2]];
}

function dot(a: ContactVector, b: ContactVector): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function pointOnSegment(segment: ContactSegment, amount: number): ContactVector {
  return [
    segment.start[0] + (segment.end[0] - segment.start[0]) * amount,
    segment.start[1] + (segment.end[1] - segment.start[1]) * amount,
    segment.start[2] + (segment.end[2] - segment.start[2]) * amount,
  ];
}

/**
 * Exact closest-feature test between the visible blade-edge segment and a
 * target torso capsule. The returned signed separation is positive outside
 * the proxy, zero at a tangent, and negative only when the edge has entered.
 */
export function measureBladeEdgeToCapsule(
  blade: ContactSegment,
  target: CapsuleContactProxy,
  contactToleranceMeters = 0.001,
): BladeCapsuleContactMeasurement {
  const d1 = subtract(blade.end, blade.start);
  const d2 = subtract(target.axis.end, target.axis.start);
  const r = subtract(blade.start, target.axis.start);
  const a = dot(d1, d1);
  const e = dot(d2, d2);
  const f = dot(d2, r);
  let blade01 = 0;
  let targetAxis01 = 0;

  if (a <= EPSILON && e <= EPSILON) {
    blade01 = 0;
    targetAxis01 = 0;
  } else if (a <= EPSILON) {
    targetAxis01 = clamp01(f / e);
  } else {
    const c = dot(d1, r);
    if (e <= EPSILON) {
      blade01 = clamp01(-c / a);
    } else {
      const b = dot(d1, d2);
      const denominator = a * e - b * b;
      if (Math.abs(denominator) > EPSILON) {
        blade01 = clamp01((b * f - c * e) / denominator);
      }
      targetAxis01 = (b * blade01 + f) / e;
      if (targetAxis01 < 0) {
        targetAxis01 = 0;
        blade01 = clamp01(-c / a);
      } else if (targetAxis01 > 1) {
        targetAxis01 = 1;
        blade01 = clamp01((b - c) / a);
      }
    }
  }

  const bladeClosest = pointOnSegment(blade, blade01);
  const axisClosest = pointOnSegment(target.axis, targetAxis01);
  const delta = subtract(bladeClosest, axisClosest);
  const centerlineMeters = Math.hypot(delta[0], delta[1], delta[2]);
  const separationMeters = centerlineMeters - target.radiusMeters;
  const closestFeature = blade01 <= 0.000001
    ? "blade-start"
    : blade01 >= 0.999999
      ? "blade-end"
      : "blade-interior";
  const isExteriorTangent =
    Math.abs(separationMeters) <= contactToleranceMeters &&
    separationMeters >= -contactToleranceMeters * 0.1;

  return {
    schema: "cow.blade-capsule-contact.v1",
    bladeClosestWorld: bladeClosest.map(rounded) as unknown as ContactVector,
    targetClosestWorld: axisClosest.map((value, index) =>
      rounded(value + (delta[index]! / Math.max(centerlineMeters, EPSILON)) * target.radiusMeters),
    ) as unknown as ContactVector,
    blade01: rounded(blade01),
    targetAxis01: rounded(targetAxis01),
    centerlineMeters: rounded(centerlineMeters),
    separationMeters: rounded(separationMeters),
    standoffMeters: rounded(Math.max(0, separationMeters)),
    penetrationMeters: rounded(Math.max(0, -separationMeters)),
    exteriorContactPoints: isExteriorTangent ? 1 : 0,
    closestFeature,
  };
}

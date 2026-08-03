import type { HordeVec2 } from "./types";

export const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

export const lengthSquared = (value: HordeVec2): number => value.x * value.x + value.z * value.z;

export const length = (value: HordeVec2): number => Math.sqrt(lengthSquared(value));

export function normalized(value: HordeVec2, fallback: HordeVec2 = { x: 0, z: -1 }): HordeVec2 {
  const magnitude = length(value);
  if (magnitude <= 1e-9) return { ...fallback };
  return { x: value.x / magnitude, z: value.z / magnitude };
}

export const dot = (left: HordeVec2, right: HordeVec2): number => left.x * right.x + left.z * right.z;

export const distanceSquared = (left: HordeVec2, right: HordeVec2): number =>
  (left.x - right.x) ** 2 + (left.z - right.z) ** 2;

export const distance = (left: HordeVec2, right: HordeVec2): number =>
  Math.sqrt(distanceSquared(left, right));

export const yawToForward = (yaw: number): HordeVec2 => ({ x: Math.sin(yaw), z: -Math.cos(yaw) });

export const directionToYaw = (direction: HordeVec2): number => Math.atan2(direction.x, -direction.z);

export function wrapAngle(angle: number): number {
  let wrapped = angle;
  while (wrapped > Math.PI) wrapped -= Math.PI * 2;
  while (wrapped < -Math.PI) wrapped += Math.PI * 2;
  return wrapped;
}

export const angleDistance = (left: number, right: number): number => Math.abs(wrapAngle(left - right));

export function approachAngle(current: number, target: number, maximumDelta: number): number {
  const delta = wrapAngle(target - current);
  return wrapAngle(current + clamp(delta, -maximumDelta, maximumDelta));
}

export const perpendicular = (value: HordeVec2, sign: -1 | 1): HordeVec2 => ({
  x: -value.z * sign,
  z: value.x * sign,
});

export function sanitizeSeed(seed: number): number {
  const unsigned = Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 0x6d2b79f5;
  return unsigned === 0 ? 0x6d2b79f5 : unsigned;
}

export function nextRandomUint(state: number): number {
  let value = sanitizeSeed(state);
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

export const random01FromUint = (value: number): number => (value >>> 0) / 0x1_0000_0000;

export function deterministicSeparationDirection(leftId: number, rightId: number): HordeVec2 {
  const hash = nextRandomUint(Math.imul(leftId + 1, 0x9e3779b1) ^ Math.imul(rightId + 7, 0x85ebca6b));
  const angle = random01FromUint(hash) * Math.PI * 2;
  return { x: Math.cos(angle), z: Math.sin(angle) };
}

export function clampToRadius(position: HordeVec2, radius: number): void {
  const currentLength = length(position);
  if (currentLength <= radius || currentLength <= 1e-9) return;
  const scale = radius / currentLength;
  position.x *= scale;
  position.z *= scale;
}

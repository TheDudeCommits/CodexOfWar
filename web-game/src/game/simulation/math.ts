import type { Vec2 } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function length(value: Vec2): number {
  return Math.hypot(value.x, value.z);
}

export function normalized(value: Vec2, fallback: Vec2 = { x: 0, z: -1 }): Vec2 {
  const magnitude = length(value);
  if (magnitude <= 0.00001) return { ...fallback };
  return { x: value.x / magnitude, z: value.z / magnitude };
}

export function yawToForward(yaw: number): Vec2 {
  return { x: Math.sin(yaw), z: -Math.cos(yaw) };
}

export function directionToYaw(direction: Vec2): number {
  return Math.atan2(direction.x, -direction.z);
}

export function shortestAngleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export function approachAngle(from: number, to: number, amount01: number): number {
  return from + shortestAngleDelta(from, to) * clamp(amount01, 0, 1);
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.z * b.z;
}

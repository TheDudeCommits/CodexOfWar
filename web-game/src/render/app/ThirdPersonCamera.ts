import * as THREE from "three";
import { approachAngle, clamp, directionToYaw, yawToForward } from "../../game/simulation/math";
import type { Vec2 } from "../../game/simulation/types";

export interface PlanarBasis {
  forward: Vec2;
  right: Vec2;
}

export interface CameraTelemetry {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  projectionMatrix: number[];
  yaw: number;
  pitch: number;
  boom: {
    desiredDistance: number;
    resolvedDistance: number;
    collisionApplied: false;
    obstructionHook: "pending";
  };
}

export class ThirdPersonCamera {
  readonly camera: THREE.PerspectiveCamera;
  private yaw = 0;
  private pitch = 0.2;
  private readonly focus = new THREE.Vector3(0, 1, 2.9);
  private readonly desiredPosition = new THREE.Vector3();
  private shakeRemaining = 0;
  private shakePhase = 0;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.08, 110);
    this.camera.position.set(0, 4.2, 10.1);
    this.camera.lookAt(this.focus);
  }

  update(
    dt: number,
    player: Vec2,
    lockTarget: Vec2 | null,
    lookX: number,
    lookY: number,
    snap = false,
  ): void {
    if (lockTarget) {
      const toTarget = { x: lockTarget.x - player.x, z: lockTarget.z - player.z };
      this.yaw = approachAngle(this.yaw, directionToYaw(toTarget), 1 - Math.exp(-dt * 7.5));
      this.pitch += (0.18 - this.pitch) * (1 - Math.exp(-dt * 5));
    } else {
      this.yaw -= lookX * 0.0023;
      this.pitch = clamp(this.pitch - lookY * 0.00175, -0.08, 0.52);
    }

    const forward = yawToForward(this.yaw);
    const right = { x: -forward.z, z: forward.x };
    const distance = lockTarget ? 7.8 : 7.15;
    const shoulderOffset = lockTarget ? 2.15 : 1.35;
    const horizontalDistance = Math.cos(this.pitch) * distance;
    const focusOffset = lockTarget
      ? {
          x: (lockTarget.x - player.x) * 0.52,
          z: (lockTarget.z - player.z) * 0.52,
        }
      : { x: forward.x * 1.25, z: forward.z * 1.25 };
    const targetFocus = new THREE.Vector3(
      player.x + focusOffset.x,
      lockTarget ? 1.02 : 1.08,
      player.z + focusOffset.z,
    );
    this.desiredPosition.set(
      player.x - forward.x * horizontalDistance + right.x * shoulderOffset,
      1.55 + Math.sin(this.pitch) * distance,
      player.z - forward.z * horizontalDistance + right.z * shoulderOffset,
    );

    const smoothing = snap ? 1 : 1 - Math.exp(-dt * 9.5);
    this.focus.lerp(targetFocus, smoothing);
    this.camera.position.lerp(this.desiredPosition, smoothing);

    if (this.shakeRemaining > 0) {
      this.shakeRemaining = Math.max(0, this.shakeRemaining - dt);
      this.shakePhase += dt * 62;
      const strength = this.shakeRemaining * 0.42;
      this.camera.position.x += Math.sin(this.shakePhase * 1.7) * strength;
      this.camera.position.y += Math.cos(this.shakePhase * 2.3) * strength * 0.65;
    }
    this.camera.lookAt(this.focus);
  }

  getPlanarBasis(): PlanarBasis {
    const forward = yawToForward(this.yaw);
    return {
      forward,
      right: { x: -forward.z, z: forward.x },
    };
  }

  kickShake(strength = 1): void {
    this.shakeRemaining = Math.max(this.shakeRemaining, 0.13 * strength);
  }

  reset(): void {
    this.yaw = 0;
    this.pitch = 0.2;
    this.camera.position.set(0, 4.2, 10.1);
    this.focus.set(0, 1, 2.9);
    this.camera.lookAt(this.focus);
  }

  getTelemetry(): CameraTelemetry {
    return {
      position: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
      quaternion: [
        this.camera.quaternion.x,
        this.camera.quaternion.y,
        this.camera.quaternion.z,
        this.camera.quaternion.w,
      ],
      projectionMatrix: this.camera.projectionMatrix.toArray(),
      yaw: this.yaw,
      pitch: this.pitch,
      boom: {
        desiredDistance: 7.15,
        resolvedDistance: 7.15,
        collisionApplied: false,
        obstructionHook: "pending",
      },
    };
  }
}

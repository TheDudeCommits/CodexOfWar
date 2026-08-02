import * as THREE from "three";
import { approachAngle, clamp, directionToYaw, yawToForward } from "../../game/simulation/math";
import type { Vec2 } from "../../game/simulation/types";

const CAMERA_FOV_DEGREES = 50;
const CAMERA_NEAR_METERS = 0.08;
const CAMERA_FAR_METERS = 120;
const CAMERA_CLEARANCE_METERS = 0.45;
const MIN_RESOLVED_BOOM_METERS = 1.15;
const CAMERA_DAMPING = 13.5;
const TARGET_YAW_DAMPING = 16;
const TARGET_FOCUS_Y = 1.53;
const SHAKE_FREQUENCY = 58;

export interface PlanarBasis {
  forward: Vec2;
  right: Vec2;
}

export type CameraBoomStatus = "clear" | "obstructed";

export interface CameraBoomTelemetry {
  desiredDistance: number;
  resolvedDistance: number;
  collisionApplied: boolean;
  status: CameraBoomStatus;
  clearance: number | null;
  hitDistance: number | null;
  colliderCount: number;
}

export interface CameraTelemetry {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  projectionMatrix: number[];
  yaw: number;
  pitch: number;
  composition: {
    targetSeparation: number | null;
    shoulderOffset: number;
    focusProgress: number;
    focus: [number, number, number];
    safeFrameInsetPx: 80;
  };
  boom: CameraBoomTelemetry;
}

export interface ProjectedBoundsTelemetry {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  margins: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    minimum: number;
  };
  insideFrame: boolean;
  insideSafeFrame: boolean;
}

export interface CameraFramingTelemetry {
  viewport: { width: number; height: number; safeInset: 80 };
  player: ProjectedBoundsTelemetry | null;
  target: ProjectedBoundsTelemetry | null;
  blade: ProjectedBoundsTelemetry | null;
  contact: {
    x: number;
    y: number;
    ndcZ: number;
    insideCentral40Percent: boolean;
  } | null;
  gates: {
    playerHeight360To540: boolean;
    actorsAndBladeInside80: boolean;
    contactInsideCentral40Percent: boolean;
  };
}

export interface CameraFramingSources {
  player: THREE.Object3D | null;
  target: THREE.Object3D | null;
  blade: THREE.Object3D | null;
  contact: THREE.Object3D | null;
}

interface DuelComposition {
  desiredDistance: number;
  shoulderOffset: number;
  focusProgress: number;
  verticalLift: number;
  targetSeparation: number | null;
}

const EMPTY_BOOM: CameraBoomTelemetry = {
  desiredDistance: 0,
  resolvedDistance: 0,
  collisionApplied: false,
  status: "clear",
  clearance: null,
  hitDistance: null,
  colliderCount: 0,
};

/**
 * Deterministic close-combat composer. Simulation state stays outside this
 * class; the camera consumes only planar actor anchors and static scene meshes.
 */
export class ThirdPersonCamera {
  readonly camera: THREE.PerspectiveCamera;
  private yaw = 0;
  private pitch = 0.2;
  private readonly focus = new THREE.Vector3(0, TARGET_FOCUS_Y, 1.35);
  private readonly targetFocus = new THREE.Vector3();
  private readonly desiredPosition = new THREE.Vector3(1.05, 2.59, 5.85);
  private readonly composedPosition = new THREE.Vector3(1.05, 2.59, 5.85);
  private readonly resolvedPosition = new THREE.Vector3(1.05, 2.59, 5.85);
  private readonly boomDirection = new THREE.Vector3();
  private readonly shakeOffset = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();
  private readonly obstructionMeshes: THREE.Mesh[] = [];
  private shakeRemaining = 0;
  private shakeDuration = 0;
  private shakeStrength = 0;
  private shakePhase = 0;
  private composition: DuelComposition = {
    desiredDistance: 4.85,
    shoulderOffset: 1.05,
    focusProgress: 0.5,
    verticalLift: 1.06,
    targetSeparation: null,
  };
  private boom: CameraBoomTelemetry = { ...EMPTY_BOOM };

  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      CAMERA_FOV_DEGREES,
      1,
      CAMERA_NEAR_METERS,
      CAMERA_FAR_METERS,
    );
    this.camera.position.copy(this.resolvedPosition);
    this.camera.lookAt(this.focus);
    this.camera.updateProjectionMatrix();
  }

  /** Collects only actual static meshes; particles and actor views are excluded. */
  setObstructionObjects(roots: readonly THREE.Object3D[]): void {
    this.obstructionMeshes.length = 0;
    const unique = new Set<THREE.Mesh>();
    for (const root of roots) {
      root.traverse((node) => {
        if (!(node instanceof THREE.Mesh) || !node.geometry.getAttribute("position")) return;
        unique.add(node);
      });
    }
    this.obstructionMeshes.push(...unique);
    this.boom = { ...this.boom, colliderCount: this.obstructionMeshes.length };
  }

  update(
    dt: number,
    player: Vec2,
    duelTarget: Vec2 | null,
    lookX: number,
    lookY: number,
    snap = false,
  ): void {
    const frameDt = clamp(dt, 0, 0.1);
    let targetDirection: Vec2 | null = null;
    let targetSeparation: number | null = null;

    if (duelTarget) {
      const toTarget = { x: duelTarget.x - player.x, z: duelTarget.z - player.z };
      targetSeparation = Math.hypot(toTarget.x, toTarget.z);
      if (targetSeparation > 0.00001) {
        targetDirection = {
          x: toTarget.x / targetSeparation,
          z: toTarget.z / targetSeparation,
        };
      } else targetDirection = yawToForward(this.yaw);
      const targetYaw = directionToYaw(targetDirection);
      this.yaw = snap
        ? targetYaw
        : approachAngle(this.yaw, targetYaw, 1 - Math.exp(-frameDt * TARGET_YAW_DAMPING));
    } else {
      this.yaw -= lookX * 0.0023;
      this.pitch = clamp(this.pitch - lookY * 0.00175, -0.08, 0.52);
    }

    this.composition = this.composeDuel(targetSeparation);
    const forward = yawToForward(this.yaw);
    const right = { x: -forward.z, z: forward.x };

    if (duelTarget && targetDirection && targetSeparation !== null) {
      this.targetFocus.set(
        player.x + targetDirection.x * targetSeparation * this.composition.focusProgress,
        TARGET_FOCUS_Y,
        player.z + targetDirection.z * targetSeparation * this.composition.focusProgress,
      );
    } else {
      this.targetFocus.set(
        player.x + forward.x * 1.05,
        1.52,
        player.z + forward.z * 1.05,
      );
    }

    const lateral = this.composition.shoulderOffset;
    const lift = this.composition.verticalLift;
    const back = Math.sqrt(
      Math.max(0, this.composition.desiredDistance ** 2 - lateral ** 2 - lift ** 2),
    );
    this.composedPosition.set(
      this.targetFocus.x - forward.x * back + right.x * lateral,
      this.targetFocus.y + lift,
      this.targetFocus.z - forward.z * back + right.z * lateral,
    );

    const smoothing = snap ? 1 : 1 - Math.exp(-frameDt * CAMERA_DAMPING);
    this.focus.lerp(this.targetFocus, smoothing);
    this.desiredPosition.lerp(this.composedPosition, smoothing);
    this.resolveBoom();

    const horizontalBoom = Math.hypot(
      this.resolvedPosition.x - this.focus.x,
      this.resolvedPosition.z - this.focus.z,
    );
    this.pitch = Math.atan2(this.resolvedPosition.y - this.focus.y, horizontalBoom);
    this.updateShake(frameDt);
    this.camera.position.copy(this.resolvedPosition).add(this.shakeOffset);
    this.camera.lookAt(this.focus);
    this.camera.updateMatrixWorld(true);
  }

  getPlanarBasis(): PlanarBasis {
    const forward = yawToForward(this.yaw);
    return {
      forward,
      right: { x: -forward.z, z: forward.x },
    };
  }

  kickShake(strength = 1): void {
    const boundedStrength = clamp(strength, 0, 2);
    const duration = 0.12 * boundedStrength;
    if (duration >= this.shakeRemaining) {
      this.shakeRemaining = duration;
      this.shakeDuration = duration;
      this.shakeStrength = boundedStrength;
    }
  }

  reset(): void {
    this.yaw = 0;
    this.pitch = 0.2;
    this.focus.set(0, TARGET_FOCUS_Y, 1.35);
    this.targetFocus.copy(this.focus);
    this.desiredPosition.set(1.05, 2.59, 5.85);
    this.composedPosition.copy(this.desiredPosition);
    this.resolvedPosition.copy(this.desiredPosition);
    this.boomDirection.set(0, 0, 1);
    this.shakeRemaining = 0;
    this.shakeDuration = 0;
    this.shakeStrength = 0;
    this.shakePhase = 0;
    this.shakeOffset.set(0, 0, 0);
    this.composition = {
      desiredDistance: 4.85,
      shoulderOffset: 1.05,
      focusProgress: 0.5,
      verticalLift: 1.06,
      targetSeparation: null,
    };
    this.boom = {
      ...EMPTY_BOOM,
      colliderCount: this.obstructionMeshes.length,
    };
    this.camera.position.copy(this.resolvedPosition);
    this.camera.lookAt(this.focus);
    this.camera.updateMatrixWorld(true);
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
      composition: {
        targetSeparation: this.composition.targetSeparation,
        shoulderOffset: this.composition.shoulderOffset,
        focusProgress: this.composition.focusProgress,
        focus: [this.focus.x, this.focus.y, this.focus.z],
        safeFrameInsetPx: 80,
      },
      boom: { ...this.boom },
    };
  }

  measureFraming(
    sources: CameraFramingSources,
    width: number,
    height: number,
  ): CameraFramingTelemetry {
    this.camera.updateMatrixWorld(true);
    const player = this.projectObjectBounds(
      sources.player,
      width,
      height,
      sources.blade ? [sources.blade] : [],
    );
    const target = this.projectObjectBounds(sources.target, width, height);
    const blade = this.projectObjectBounds(sources.blade, width, height);
    const contact = sources.contact
      ? this.projectPoint(sources.contact.getWorldPosition(new THREE.Vector3()), width, height)
      : null;
    const contactTelemetry = contact
      ? {
          ...contact,
          insideCentral40Percent:
            contact.x >= width * 0.3 &&
            contact.x <= width * 0.7 &&
            contact.y >= height * 0.3 &&
            contact.y <= height * 0.7 &&
            contact.ndcZ >= -1 &&
            contact.ndcZ <= 1,
        }
      : null;
    const safeObjects = [player, target, blade];
    return {
      viewport: { width, height, safeInset: 80 },
      player,
      target,
      blade,
      contact: contactTelemetry,
      gates: {
        playerHeight360To540: player !== null && player.height >= 360 && player.height <= 540,
        actorsAndBladeInside80:
          safeObjects.every((bounds) => bounds !== null && bounds.insideSafeFrame),
        contactInsideCentral40Percent: contactTelemetry?.insideCentral40Percent ?? false,
      },
    };
  }

  private composeDuel(targetSeparation: number | null): DuelComposition {
    if (targetSeparation === null) {
      return {
        desiredDistance: 4.85,
        shoulderOffset: 1.05,
        focusProgress: 0.5,
        verticalLift: 1.06,
        targetSeparation: null,
      };
    }
    const separation = clamp(targetSeparation, 0.9, 8);
    return {
      // Close at contact, then widen gradually enough to preserve both actors.
      desiredDistance: clamp(4.9 + separation * 0.225, 5.18, 6.45),
      shoulderOffset: clamp(0.92 + separation * 0.09, 1.04, 1.48),
      // At combat range the focus sits just beyond the midpoint: the strike
      // contact stays central while Nyra remains a strong left-shoulder mass.
      focusProgress: clamp(0.555 - separation * 0.01, 0.48, 0.545),
      verticalLift: clamp(1.02 + separation * 0.025, 1.045, 1.18),
      targetSeparation,
    };
  }

  private resolveBoom(): void {
    this.boomDirection.subVectors(this.desiredPosition, this.focus);
    const desiredDistance = this.boomDirection.length();
    if (desiredDistance <= 0.00001) {
      this.resolvedPosition.copy(this.focus);
      this.boom = {
        desiredDistance: 0,
        resolvedDistance: 0,
        collisionApplied: false,
        status: "clear",
        clearance: null,
        hitDistance: null,
        colliderCount: this.obstructionMeshes.length,
      };
      return;
    }
    this.boomDirection.multiplyScalar(1 / desiredDistance);
    for (const mesh of this.obstructionMeshes) mesh.updateWorldMatrix(true, false);
    this.raycaster.set(this.focus, this.boomDirection);
    this.raycaster.near = 0.02;
    this.raycaster.far = desiredDistance;
    const hit = this.raycaster
      .intersectObjects(this.obstructionMeshes, false)
      .find((entry) => entry.distance > this.raycaster.near);

    if (!hit) {
      this.resolvedPosition.copy(this.desiredPosition);
      this.boom = {
        desiredDistance,
        resolvedDistance: desiredDistance,
        collisionApplied: false,
        status: "clear",
        clearance: null,
        hitDistance: null,
        colliderCount: this.obstructionMeshes.length,
      };
      return;
    }

    const resolvedDistance = clamp(
      hit.distance - CAMERA_CLEARANCE_METERS,
      MIN_RESOLVED_BOOM_METERS,
      desiredDistance,
    );
    const collisionApplied = resolvedDistance < desiredDistance - 0.000001;
    this.resolvedPosition
      .copy(this.boomDirection)
      .multiplyScalar(resolvedDistance)
      .add(this.focus);
    this.boom = {
      desiredDistance,
      resolvedDistance,
      collisionApplied,
      status: collisionApplied ? "obstructed" : "clear",
      clearance: collisionApplied ? hit.distance - resolvedDistance : null,
      hitDistance: hit.distance,
      colliderCount: this.obstructionMeshes.length,
    };
  }

  private updateShake(dt: number): void {
    if (this.shakeRemaining <= 0 || this.shakeDuration <= 0) {
      this.shakeOffset.set(0, 0, 0);
      return;
    }
    if (dt > 0) {
      this.shakeRemaining = Math.max(0, this.shakeRemaining - dt);
      this.shakePhase += dt * SHAKE_FREQUENCY;
    }
    const envelope = this.shakeRemaining / this.shakeDuration;
    const amplitude = 0.045 * this.shakeStrength * envelope * envelope;
    this.shakeOffset.set(
      Math.sin(this.shakePhase * 1.71) * amplitude,
      Math.cos(this.shakePhase * 2.29) * amplitude * 0.56,
      Math.sin(this.shakePhase * 1.13 + 0.7) * amplitude * 0.28,
    );
    if (this.shakeRemaining <= 0) {
      this.shakeDuration = 0;
      this.shakeStrength = 0;
      this.shakeOffset.set(0, 0, 0);
    }
  }

  private projectObjectBounds(
    root: THREE.Object3D | null,
    width: number,
    height: number,
    excludedRoots: readonly THREE.Object3D[] = [],
  ): ProjectedBoundsTelemetry | null {
    if (!root) return null;
    root.updateWorldMatrix(true, true);
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    const vertex = new THREE.Vector3();
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || !this.isEffectivelyVisible(node)) return;
      if (excludedRoots.some((excluded) => this.isDescendantOf(node, excluded))) return;
      const positions = node.geometry.getAttribute("position");
      if (!positions) return;
      for (let index = 0; index < positions.count; index += 1) {
        node.getVertexPosition(index, vertex);
        vertex.applyMatrix4(node.matrixWorld).project(this.camera);
        if (!Number.isFinite(vertex.x) || !Number.isFinite(vertex.y)) continue;
        const screenX = (vertex.x * 0.5 + 0.5) * width;
        const screenY = (-vertex.y * 0.5 + 0.5) * height;
        minX = Math.min(minX, screenX);
        minY = Math.min(minY, screenY);
        maxX = Math.max(maxX, screenX);
        maxY = Math.max(maxY, screenY);
      }
    });
    if (!Number.isFinite(minX)) return null;
    const margins = {
      left: minX,
      top: minY,
      right: width - maxX,
      bottom: height - maxY,
      minimum: Math.min(minX, minY, width - maxX, height - maxY),
    };
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
      margins,
      insideFrame: margins.minimum >= 0,
      insideSafeFrame: margins.minimum >= 80,
    };
  }

  private projectPoint(
    world: THREE.Vector3,
    width: number,
    height: number,
  ): { x: number; y: number; ndcZ: number } {
    const projected = world.project(this.camera);
    return {
      x: (projected.x * 0.5 + 0.5) * width,
      y: (-projected.y * 0.5 + 0.5) * height,
      ndcZ: projected.z,
    };
  }

  private isDescendantOf(node: THREE.Object3D, ancestor: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = node;
    while (current) {
      if (current === ancestor) return true;
      current = current.parent;
    }
    return false;
  }

  private isEffectivelyVisible(node: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = node;
    while (current) {
      if (!current.visible) return false;
      current = current.parent;
    }
    return true;
  }
}

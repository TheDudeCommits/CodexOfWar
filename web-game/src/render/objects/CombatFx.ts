import * as THREE from "three";

const STREAK_COUNT = 22;
const CONTACT_TANGENT_OFFSET = 0.82;
const CONTACT_VERTICAL_OFFSET = -0.32;
const CONTACT_SURFACE_OFFSET = 0.2;
const FLASH_LIFE = 0.125;
const DEFEAT_FLASH_LIFE = 0.15;
const UNIT_X = new THREE.Vector3(1, 0, 0);

function hash(seed: number): number {
  const value = Math.sin(seed * 91.173) * 43758.5453;
  return value - Math.floor(value);
}

function roundFx(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function createTaperedStreakGeometry(): THREE.BufferGeometry {
  // Two crossed fins keep each procedural streak fine from the frozen camera
  // without a texture/billboard slot. Both fins taper to one trailing point.
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([
      0, -0.5, 0,
      0, 0.5, 0,
      -1, 0, 0,
      0, 0, -0.5,
      0, 0, 0.5,
      -1, 0, 0,
    ], 3),
  );
  geometry.setIndex([0, 1, 2, 3, 4, 5]);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createImpactStarGeometry(): THREE.BufferGeometry {
  const positions = [0, 0, 0];
  const indices: number[] = [];
  const points = 24;
  for (let index = 0; index < points; index += 1) {
    const angle = (index / points) * Math.PI * 2;
    const radius = index % 3 === 0 ? 1 : index % 3 === 1 ? 0.2 : 0.13;
    positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
  }
  for (let index = 0; index < points; index += 1) {
    indices.push(0, index + 1, ((index + 1) % points) + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export interface CombatFxTelemetry {
  schema: "cow.contact-fx.v1";
  phase: "absent" | "peak" | "dissipating" | "dissipated";
  active: boolean;
  lastBurstSerial: number;
  contactWorld: [number, number, number];
  sourceAnchorWorld: [number, number, number];
  strikeTravel: [number, number, number];
  swingTravel: [number, number, number];
  contactOffset: {
    tangent: number;
    vertical: number;
    surface: number;
  };
  flash: {
    active: boolean;
    life: number;
    opacity: number;
    scale: number;
  };
  streaks: {
    active: boolean;
    activeCount: number;
    totalCount: number;
    opacity: number;
    maxDistance: number;
    taperedCrossFins: true;
  };
  materialContract: {
    additive: true;
    transparent: true;
    depthWrite: false;
    textures: 0;
  };
}

export interface CombatFxAuditApi {
  telemetry: () => CombatFxTelemetry;
  setAuditVisible: (visible: boolean) => void;
}

declare global {
  interface Window {
    __COW_COMBAT_FX__?: CombatFxAuditApi;
  }
}

export class CombatFx {
  readonly root = new THREE.Group();
  private readonly streakPositions = new Float32Array(STREAK_COUNT * 3);
  private readonly streakVelocities = new Float32Array(STREAK_COUNT * 3);
  private readonly streakLives = new Float32Array(STREAK_COUNT);
  private readonly streakDurations = new Float32Array(STREAK_COUNT);
  private readonly streakLengths = new Float32Array(STREAK_COUNT);
  private readonly streakWidths = new Float32Array(STREAK_COUNT);
  private readonly streakGeometry = createTaperedStreakGeometry();
  private readonly streakMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexColors: false,
  });
  private readonly streaks = new THREE.InstancedMesh(
    this.streakGeometry,
    this.streakMaterial,
    STREAK_COUNT,
  );
  private readonly flashGeometry = createImpactStarGeometry();
  private readonly flashMaterial = new THREE.MeshBasicMaterial({
    color: 0xffb35f,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  private readonly flash = new THREE.Mesh(this.flashGeometry, this.flashMaterial);
  private readonly coreGeometry = new THREE.OctahedronGeometry(1, 0);
  private readonly coreMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff4d1,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
  private readonly core = new THREE.Mesh(this.coreGeometry, this.coreMaterial);
  private readonly flashLight = new THREE.PointLight(0xff8f49, 0, 0.72, 2);
  private readonly matrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly position = new THREE.Vector3();
  private readonly velocity = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly color = new THREE.Color();
  private readonly combatFxAuditApi: CombatFxAuditApi = {
    telemetry: () => this.getTelemetry(),
    setAuditVisible: (visible) => {
      this.auditVisible = visible;
      this.root.visible = visible;
    },
  };
  private readonly sourceAnchor = new THREE.Vector3();
  private readonly strikeTravel = new THREE.Vector3(0, 0, -1);
  private readonly swingTravel = new THREE.Vector3(1, 0, 0);
  private activeStreakCount = 0;
  private flashLife = 0;
  private flashDuration = FLASH_LIFE;
  private lastBurstSerial = 0;
  private lastElapsed = 0;
  private auditVisible = true;

  constructor() {
    this.root.name = "fx.contact-stack";
    this.streakMaterial.forceSinglePass = true;
    this.flashMaterial.forceSinglePass = true;
    this.streaks.name = "fx.directional-tapered-streaks";
    this.streaks.visible = false;
    this.streaks.frustumCulled = false;
    this.streaks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.streaks.renderOrder = 31;
    this.flash.name = "fx.contact-local-flash";
    this.flash.visible = false;
    this.flash.frustumCulled = false;
    this.flash.renderOrder = 32;
    this.core.name = "fx.contact-hot-core";
    this.core.visible = false;
    this.core.frustumCulled = false;
    this.core.renderOrder = 33;
    this.root.add(this.streaks, this.flash, this.core, this.flashLight);

    for (let index = 0; index < STREAK_COUNT; index += 1) {
      this.scale.setScalar(0);
      this.matrix.compose(this.position.set(0, 0, 0), this.quaternion.identity(), this.scale);
      this.streaks.setMatrixAt(index, this.matrix);
      this.color.setHex(index < 15 ? (index % 4 === 0 ? 0xffdf9a : 0xff9443) : 0xff5932);
      this.streaks.setColorAt(index, this.color);
    }
    this.streaks.instanceMatrix.needsUpdate = true;
    if (this.streaks.instanceColor) this.streaks.instanceColor.needsUpdate = true;
    if (typeof window !== "undefined") window.__COW_COMBAT_FX__ = this.combatFxAuditApi;
  }

  burst(
    x: number,
    y: number,
    z: number,
    directionX: number,
    directionZ: number,
    serial: number,
    defeated: boolean,
  ): void {
    const directionLength = Math.hypot(directionX, directionZ);
    const strikeX = directionLength > 0.0001 ? directionX / directionLength : 0;
    const strikeZ = directionLength > 0.0001 ? directionZ / directionLength : -1;
    const swingX = -strikeZ;
    const swingZ = strikeX;
    this.sourceAnchor.set(x, y, z);
    this.strikeTravel.set(strikeX, 0, strikeZ);
    this.swingTravel.set(swingX, 0, swingZ);
    this.root.position.set(
      x + swingX * CONTACT_TANGENT_OFFSET - strikeX * CONTACT_SURFACE_OFFSET,
      y + CONTACT_VERTICAL_OFFSET,
      z + swingZ * CONTACT_TANGENT_OFFSET - strikeZ * CONTACT_SURFACE_OFFSET,
    );
    this.root.visible = this.auditVisible;
    this.lastBurstSerial = serial;
    this.flashDuration = defeated ? DEFEAT_FLASH_LIFE : FLASH_LIFE;
    this.flashLife = this.flashDuration;
    this.flashMaterial.color.setHex(defeated ? 0xffd78c : 0xffa657);
    this.flashMaterial.opacity = 0.82;
    this.flash.rotation.z = (hash(serial * 7.13) - 0.5) * 0.45;
    this.flash.scale.setScalar(defeated ? 0.23 : 0.19);
    this.flash.visible = true;
    this.coreMaterial.color.setHex(defeated ? 0xffffe6 : 0xfff0c2);
    this.coreMaterial.opacity = 1;
    this.core.scale.setScalar(defeated ? 0.072 : 0.058);
    this.core.visible = true;
    this.flashLight.color.setHex(defeated ? 0xffb968 : 0xff8742);
    this.flashLight.intensity = defeated ? 2 : 1;

    for (let index = 0; index < STREAK_COUNT; index += 1) {
      const offset = index * 3;
      const fastSpark = index < 15;
      const lateral = (hash(index * 2.91 + serial * 1.73) - 0.5) * (fastSpark ? 0.42 : 0.24);
      const forward = (fastSpark ? 0.3 : 0.1) + hash(index * 4.37 + serial) * 0.62;
      const speed = fastSpark
        ? 3.4 + hash(index * 5.11 + serial * 0.7) * 3.2
        : 1.2 + hash(index * 6.23 + serial * 1.3) * 1.4;
      const lift = fastSpark
        ? -0.25 + hash(index * 7.41 + serial * 2.1) * 2.5
        : 0.45 + hash(index * 8.17 + serial * 2.7) * 1.25;

      this.streakPositions[offset] = (hash(index * 1.31 + serial) - 0.5) * 0.075;
      this.streakPositions[offset + 1] = (hash(index * 3.19 + serial) - 0.5) * 0.1;
      this.streakPositions[offset + 2] = (hash(index * 4.81 + serial) - 0.5) * 0.055;
      this.streakVelocities[offset] =
        swingX * speed + strikeX * forward + strikeZ * lateral;
      this.streakVelocities[offset + 1] = lift;
      this.streakVelocities[offset + 2] =
        swingZ * speed + strikeZ * forward - strikeX * lateral;
      const duration = fastSpark
        ? 0.14 + hash(index * 9.07 + serial) * 0.075
        : 0.18 + hash(index * 10.03 + serial) * 0.055;
      this.streakLives[index] = duration;
      this.streakDurations[index] = duration;
      this.streakLengths[index] = fastSpark
        ? 0.13 + hash(index * 11.09 + serial) * 0.15
        : 0.065 + hash(index * 12.13 + serial) * 0.075;
      this.streakWidths[index] = fastSpark
        ? 0.015 + hash(index * 13.17 + serial) * 0.01
        : 0.012 + hash(index * 14.23 + serial) * 0.007;
    }
    this.activeStreakCount = STREAK_COUNT;
    this.streakMaterial.opacity = 0.78;
    this.streaks.visible = true;
    this.writeStreakMatrices();
  }

  update(dt: number, elapsed: number): void {
    if (elapsed < this.lastElapsed) this.reset();
    this.lastElapsed = elapsed;
    this.updateStreaks(dt);
    this.updateFlash(dt);
  }

  getTelemetry(): CombatFxTelemetry {
    const maxDistance = this.measureMaxStreakDistance();
    const phase = this.lastBurstSerial === 0
      ? "absent"
      : this.flashLife > 0
        ? "peak"
        : this.activeStreakCount > 0
          ? "dissipating"
          : "dissipated";
    return {
      schema: "cow.contact-fx.v1",
      phase,
      active: this.flashLife > 0 || this.activeStreakCount > 0,
      lastBurstSerial: this.lastBurstSerial,
      contactWorld: this.root.position.toArray().map(roundFx) as [number, number, number],
      sourceAnchorWorld: this.sourceAnchor.toArray().map(roundFx) as [number, number, number],
      strikeTravel: this.strikeTravel.toArray().map(roundFx) as [number, number, number],
      swingTravel: this.swingTravel.toArray().map(roundFx) as [number, number, number],
      contactOffset: {
        tangent: CONTACT_TANGENT_OFFSET,
        vertical: CONTACT_VERTICAL_OFFSET,
        surface: CONTACT_SURFACE_OFFSET,
      },
      flash: {
        active: this.flash.visible,
        life: roundFx(this.flashLife),
        opacity: roundFx(this.flashMaterial.opacity),
        scale: roundFx(this.flash.scale.x),
      },
      streaks: {
        active: this.streaks.visible,
        activeCount: this.activeStreakCount,
        totalCount: STREAK_COUNT,
        opacity: roundFx(this.streakMaterial.opacity),
        maxDistance: roundFx(maxDistance),
        taperedCrossFins: true,
      },
      materialContract: {
        additive: true,
        transparent: true,
        depthWrite: false,
        textures: 0,
      },
    };
  }

  dispose(): void {
    if (
      typeof window !== "undefined" &&
      window.__COW_COMBAT_FX__ === this.combatFxAuditApi
    ) {
      window.__COW_COMBAT_FX__ = undefined;
    }
    this.streakGeometry.dispose();
    this.streakMaterial.dispose();
    this.flashGeometry.dispose();
    this.flashMaterial.dispose();
    this.coreGeometry.dispose();
    this.coreMaterial.dispose();
  }

  private updateStreaks(dt: number): void {
    if (this.activeStreakCount <= 0) return;
    for (let index = 0; index < STREAK_COUNT; index += 1) {
      if (this.streakLives[index]! <= 0) continue;
      const offset = index * 3;
      this.streakLives[index] = Math.max(0, this.streakLives[index]! - dt);
      this.streakPositions[offset] =
        this.streakPositions[offset]! + this.streakVelocities[offset]! * dt;
      this.streakPositions[offset + 1] =
        this.streakPositions[offset + 1]! + this.streakVelocities[offset + 1]! * dt;
      this.streakPositions[offset + 2] =
        this.streakPositions[offset + 2]! + this.streakVelocities[offset + 2]! * dt;
      const drag = Math.pow(0.91, dt * 60);
      this.streakVelocities[offset] = this.streakVelocities[offset]! * drag;
      this.streakVelocities[offset + 1] = this.streakVelocities[offset + 1]! - 5.2 * dt;
      this.streakVelocities[offset + 2] = this.streakVelocities[offset + 2]! * drag;
    }
    this.writeStreakMatrices();
  }

  private updateFlash(dt: number): void {
    if (this.flashLife <= 0) return;
    this.flashLife = Math.max(0, this.flashLife - dt);
    const life01 = this.flashDuration > 0 ? this.flashLife / this.flashDuration : 0;
    this.flashMaterial.opacity = 0.82 * Math.pow(life01, 0.68);
    this.coreMaterial.opacity = Math.min(1, life01 * 1.65);
    this.flash.scale.setScalar(
      (this.flashDuration === DEFEAT_FLASH_LIFE ? 0.23 : 0.19) + (1 - life01) * 0.08,
    );
    this.core.scale.setScalar(
      (this.flashDuration === DEFEAT_FLASH_LIFE ? 0.072 : 0.058) * (0.72 + life01 * 0.28),
    );
    this.flashLight.intensity =
      (this.flashDuration === DEFEAT_FLASH_LIFE ? 2 : 1) * life01 * life01;
    if (this.flashLife <= 0) {
      this.flash.visible = false;
      this.core.visible = false;
      this.flashMaterial.opacity = 0;
      this.coreMaterial.opacity = 0;
      this.flashLight.intensity = 0;
    }
  }

  private writeStreakMatrices(): void {
    let active = 0;
    let strongestLife01 = 0;
    for (let index = 0; index < STREAK_COUNT; index += 1) {
      const offset = index * 3;
      const life = this.streakLives[index]!;
      const duration = this.streakDurations[index]!;
      const life01 = duration > 0 ? life / duration : 0;
      if (life > 0) {
        active += 1;
        strongestLife01 = Math.max(strongestLife01, life01);
        this.position.set(
          this.streakPositions[offset]!,
          this.streakPositions[offset + 1]!,
          this.streakPositions[offset + 2]!,
        );
        this.velocity.set(
          this.streakVelocities[offset]!,
          this.streakVelocities[offset + 1]!,
          this.streakVelocities[offset + 2]!,
        );
        if (this.velocity.lengthSq() > 0.000001) {
          this.velocity.normalize();
          this.quaternion.setFromUnitVectors(UNIT_X, this.velocity);
        } else this.quaternion.identity();
        const taper = Math.pow(life01, 0.55);
        this.scale.set(
          this.streakLengths[index]! * (0.48 + taper * 0.52),
          this.streakWidths[index]! * taper,
          this.streakWidths[index]! * taper,
        );
      } else {
        this.position.set(0, 0, 0);
        this.quaternion.identity();
        this.scale.setScalar(0);
      }
      this.matrix.compose(this.position, this.quaternion, this.scale);
      this.streaks.setMatrixAt(index, this.matrix);
    }
    this.activeStreakCount = active;
    this.streakMaterial.opacity = Math.min(0.78, strongestLife01 * 0.9);
    this.streaks.visible = active > 0;
    this.streaks.instanceMatrix.needsUpdate = true;
  }

  private measureMaxStreakDistance(): number {
    let maximum = 0;
    for (let index = 0; index < STREAK_COUNT; index += 1) {
      if (this.streakLives[index]! <= 0) continue;
      const offset = index * 3;
      maximum = Math.max(
        maximum,
        Math.hypot(
          this.streakPositions[offset]!,
          this.streakPositions[offset + 1]!,
          this.streakPositions[offset + 2]!,
        ) + this.streakLengths[index]!,
      );
    }
    return maximum;
  }

  private reset(): void {
    this.lastBurstSerial = 0;
    this.activeStreakCount = 0;
    this.flashLife = 0;
    this.sourceAnchor.set(0, 0, 0);
    this.root.position.set(0, 0, 0);
    this.streakLives.fill(0);
    this.streakMaterial.opacity = 0;
    this.streaks.visible = false;
    this.flash.visible = false;
    this.core.visible = false;
    this.flashMaterial.opacity = 0;
    this.coreMaterial.opacity = 0;
    this.flashLight.intensity = 0;
  }
}

import * as THREE from "three";

const SPARK_COUNT = 26;
const DEBRIS_COUNT = 12;

function hash(seed: number): number {
  const value = Math.sin(seed * 91.173) * 43758.5453;
  return value - Math.floor(value);
}

export class CombatFx {
  readonly root = new THREE.Group();
  private readonly sparkPositions = new Float32Array(SPARK_COUNT * 3);
  private readonly sparkVelocities = new Float32Array(SPARK_COUNT * 3);
  private readonly sparkGeometry = new THREE.BufferGeometry();
  private readonly sparkMaterial: THREE.PointsMaterial;
  private readonly sparks: THREE.Points;
  private readonly flashMaterial: THREE.MeshBasicMaterial;
  private readonly flash: THREE.Mesh;
  private readonly flashLight = new THREE.PointLight(0xff6c39, 0, 5.5, 2);
  private readonly debrisPositions = new Float32Array(DEBRIS_COUNT * 3);
  private readonly debrisVelocities = new Float32Array(DEBRIS_COUNT * 3);
  private readonly debrisAngles = new Float32Array(DEBRIS_COUNT * 3);
  private readonly debrisAngularVelocities = new Float32Array(DEBRIS_COUNT * 3);
  private readonly debrisScales = new Float32Array(DEBRIS_COUNT);
  private readonly debrisGeometry = new THREE.DodecahedronGeometry(0.075, 0);
  private readonly debrisMaterial = new THREE.MeshStandardMaterial({
    color: 0x7b5d49,
    roughness: 0.92,
    metalness: 0.04,
  });
  private readonly debris = new THREE.InstancedMesh(
    this.debrisGeometry,
    this.debrisMaterial,
    DEBRIS_COUNT,
  );
  private readonly matrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly euler = new THREE.Euler();
  private sparkLife = 0;
  private flashLife = 0;
  private debrisLife = 0;
  private lastElapsed = 0;

  constructor() {
    this.root.name = "fx.contact-stack";
    this.sparkGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.sparkPositions, 3),
    );
    this.sparkGeometry.setDrawRange(0, 0);
    this.sparkMaterial = new THREE.PointsMaterial({
      color: 0xffa05f,
      size: 0.105,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.sparks = new THREE.Points(this.sparkGeometry, this.sparkMaterial);
    this.sparks.name = "fx.directional-sparks";

    this.flashMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd0a1,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
      toneMapped: false,
    });
    this.flash = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 1), this.flashMaterial);
    this.flash.name = "fx.hit-flash";
    this.flash.visible = false;

    this.debris.name = "fx.short-lived-debris";
    this.debris.castShadow = true;
    this.debris.visible = false;
    this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.root.add(this.sparks, this.flash, this.flashLight, this.debris);
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
    this.root.position.set(x, y, z);
    this.sparkLife = defeated ? 0.68 : 0.42;
    this.flashLife = defeated ? 0.25 : 0.16;
    this.debrisLife = defeated ? 0.82 : 0.52;
    this.sparkMaterial.color.setHex(defeated ? 0xffd08b : 0xff8a4c);
    this.sparkMaterial.opacity = 1;
    this.flashMaterial.color.setHex(defeated ? 0xfff0bd : 0xffc091);
    this.flashMaterial.opacity = 0.38;
    this.flash.visible = true;
    this.flash.scale.setScalar(0.5);
    this.flashLight.color.setHex(defeated ? 0xffb768 : 0xff6937);
    this.flashLight.intensity = defeated ? 15 : 8;

    const tangentX = -directionZ;
    const tangentZ = directionX;
    for (let index = 0; index < SPARK_COUNT; index += 1) {
      const offset = index * 3;
      this.sparkPositions[offset] = 0;
      this.sparkPositions[offset + 1] = 0;
      this.sparkPositions[offset + 2] = 0;
      const spread = (hash(index * 2.7 + serial * 3.1) - 0.5) * 2;
      const speed = 2.4 + hash(index * 5.9 + serial) * (defeated ? 5.2 : 3.4);
      this.sparkVelocities[offset] = directionX * speed + tangentX * spread * 2.3;
      this.sparkVelocities[offset + 1] = 0.7 + hash(index * 7.3 + serial) * 4.8;
      this.sparkVelocities[offset + 2] = directionZ * speed + tangentZ * spread * 2.3;
    }
    this.sparkGeometry.setDrawRange(0, SPARK_COUNT);
    this.sparkGeometry.attributes.position!.needsUpdate = true;

    this.debris.visible = true;
    for (let index = 0; index < DEBRIS_COUNT; index += 1) {
      const offset = index * 3;
      this.debrisPositions[offset] = 0;
      this.debrisPositions[offset + 1] = -0.35;
      this.debrisPositions[offset + 2] = 0;
      const spread = (hash(index * 3.7 + serial * 1.9) - 0.5) * 2;
      const speed = 0.8 + hash(index * 4.1 + serial) * (defeated ? 3.5 : 2.1);
      this.debrisVelocities[offset] = directionX * speed + tangentX * spread;
      this.debrisVelocities[offset + 1] = 1.2 + hash(index * 8.7 + serial) * 3.4;
      this.debrisVelocities[offset + 2] = directionZ * speed + tangentZ * spread;
      this.debrisAngles[offset] = hash(index + serial) * Math.PI;
      this.debrisAngles[offset + 1] = hash(index * 3.3 + serial) * Math.PI;
      this.debrisAngles[offset + 2] = hash(index * 6.7 + serial) * Math.PI;
      this.debrisAngularVelocities[offset] = (hash(index * 2.2 + serial) - 0.5) * 12;
      this.debrisAngularVelocities[offset + 1] = (hash(index * 4.9 + serial) - 0.5) * 12;
      this.debrisAngularVelocities[offset + 2] = (hash(index * 7.6 + serial) - 0.5) * 12;
      this.debrisScales[index] = 0.65 + hash(index * 9.2 + serial) * 1.1;
    }
    this.writeDebrisMatrices();
  }

  update(dt: number, elapsed: number): void {
    if (elapsed < this.lastElapsed) this.reset();
    this.lastElapsed = elapsed;
    this.updateSparks(dt);
    this.updateFlash(dt);
    this.updateDebris(dt);
  }

  dispose(): void {
    this.sparkGeometry.dispose();
    this.sparkMaterial.dispose();
    this.flash.geometry.dispose();
    this.flashMaterial.dispose();
    this.debrisGeometry.dispose();
    this.debrisMaterial.dispose();
  }

  private updateSparks(dt: number): void {
    if (this.sparkLife <= 0) return;
    this.sparkLife = Math.max(0, this.sparkLife - dt);
    for (let index = 0; index < SPARK_COUNT; index += 1) {
      const offset = index * 3;
      this.sparkPositions[offset] = this.sparkPositions[offset]! + this.sparkVelocities[offset]! * dt;
      this.sparkPositions[offset + 1] = this.sparkPositions[offset + 1]! + this.sparkVelocities[offset + 1]! * dt;
      this.sparkPositions[offset + 2] = this.sparkPositions[offset + 2]! + this.sparkVelocities[offset + 2]! * dt;
      this.sparkVelocities[offset] = this.sparkVelocities[offset]! * 0.965;
      this.sparkVelocities[offset + 1] = this.sparkVelocities[offset + 1]! - 8.8 * dt;
      this.sparkVelocities[offset + 2] = this.sparkVelocities[offset + 2]! * 0.965;
    }
    this.sparkMaterial.opacity = Math.min(1, this.sparkLife * 3.8);
    this.sparkGeometry.attributes.position!.needsUpdate = true;
    if (this.sparkLife <= 0) this.sparkGeometry.setDrawRange(0, 0);
  }

  private updateFlash(dt: number): void {
    if (this.flashLife <= 0) return;
    this.flashLife = Math.max(0, this.flashLife - dt);
    const life01 = this.flashLife / 0.25;
    this.flashMaterial.opacity = Math.min(0.38, this.flashLife * 3.1);
    this.flash.scale.setScalar(0.45 + (1 - life01) * 1.15);
    this.flashLight.intensity *= Math.pow(0.001, dt / 0.25);
    if (this.flashLife <= 0) {
      this.flash.visible = false;
      this.flashLight.intensity = 0;
    }
  }

  private updateDebris(dt: number): void {
    if (this.debrisLife <= 0) return;
    this.debrisLife = Math.max(0, this.debrisLife - dt);
    for (let index = 0; index < DEBRIS_COUNT; index += 1) {
      const offset = index * 3;
      this.debrisPositions[offset] = this.debrisPositions[offset]! + this.debrisVelocities[offset]! * dt;
      this.debrisPositions[offset + 1] = Math.max(
        -0.98,
        this.debrisPositions[offset + 1]! + this.debrisVelocities[offset + 1]! * dt,
      );
      this.debrisPositions[offset + 2] = this.debrisPositions[offset + 2]! + this.debrisVelocities[offset + 2]! * dt;
      this.debrisVelocities[offset + 1] = this.debrisVelocities[offset + 1]! - 8.6 * dt;
      this.debrisAngles[offset] = this.debrisAngles[offset]! + this.debrisAngularVelocities[offset]! * dt;
      this.debrisAngles[offset + 1] = this.debrisAngles[offset + 1]! + this.debrisAngularVelocities[offset + 1]! * dt;
      this.debrisAngles[offset + 2] = this.debrisAngles[offset + 2]! + this.debrisAngularVelocities[offset + 2]! * dt;
    }
    this.writeDebrisMatrices();
    if (this.debrisLife <= 0) this.debris.visible = false;
  }

  private writeDebrisMatrices(): void {
    const fade = Math.min(1, this.debrisLife * 3.5);
    for (let index = 0; index < DEBRIS_COUNT; index += 1) {
      const offset = index * 3;
      this.position.set(
        this.debrisPositions[offset]!,
        this.debrisPositions[offset + 1]!,
        this.debrisPositions[offset + 2]!,
      );
      this.euler.set(
        this.debrisAngles[offset]!,
        this.debrisAngles[offset + 1]!,
        this.debrisAngles[offset + 2]!,
      );
      this.quaternion.setFromEuler(this.euler);
      const size = this.debrisScales[index]! * fade;
      this.scale.setScalar(size);
      this.matrix.compose(this.position, this.quaternion, this.scale);
      this.debris.setMatrixAt(index, this.matrix);
    }
    this.debris.instanceMatrix.needsUpdate = true;
  }

  private reset(): void {
    this.sparkLife = 0;
    this.flashLife = 0;
    this.debrisLife = 0;
    this.sparkGeometry.setDrawRange(0, 0);
    this.flash.visible = false;
    this.flashLight.intensity = 0;
    this.debris.visible = false;
  }
}

import * as THREE from "three";
import type { RenderedBladePrimitive, TargetLandmarkName } from "./CharacterViews";

export const HEAVY_CONTACT_EPSILON_METERS = 0.000001;
export const HEAVY_BLADE_RADIUS_METERS = 0.02;
export const HEAVY_SWEEP_SUBSTEPS = 4096;

export interface HeavyGeometryBindings {
  leftHandBone: THREE.Object3D;
  rightHandBone: THREE.Object3D;
  swordBladePrimitives: readonly RenderedBladePrimitive[];
  targetSkinnedMeshes: readonly THREE.SkinnedMesh[];
  targetLandmarkBones: Readonly<Record<TargetLandmarkName, THREE.Object3D>>;
}

export interface BladeAxisSample {
  guard: THREE.Vector3;
  tip: THREE.Vector3;
}

interface CapsuleSample {
  id: string;
  start: THREE.Vector3;
  end: THREE.Vector3;
  radius: number;
}

interface GeometrySample {
  blade: BladeAxisSample;
  capsules: CapsuleSample[];
}

export interface HeavyContactTickReceipt {
  stateSeparationMeters: number;
  minimumSweepSeparationMeters: number;
  contactingAtEnd: boolean;
  risingContact: boolean;
  contactSubstep: number | null;
  contactCapsuleID: string | null;
}

function materialAt(mesh: THREE.Mesh, index: number): THREE.Material | null {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials[index] ?? materials[0] ?? null;
}

function isRenderedOpaque(mesh: THREE.Mesh, groupIndex: number): boolean {
  if (!mesh.visible || !mesh.layers.test(new THREE.Layers())) return mesh.visible;
  const geometry = mesh.geometry;
  const group = geometry.groups[groupIndex];
  const material = materialAt(mesh, group?.materialIndex ?? groupIndex);
  return Boolean(material?.visible && material.opacity >= 0.95);
}

function includedVertexIndices(mesh: THREE.Mesh, groupIndices: readonly number[]): number[] {
  const geometry = mesh.geometry;
  const index = geometry.index;
  const vertexCount = geometry.getAttribute("position")?.count ?? 0;
  const drawStart = Math.max(0, geometry.drawRange.start);
  const drawCount = Number.isFinite(geometry.drawRange.count)
    ? geometry.drawRange.count
    : index?.count ?? vertexCount;
  const drawEnd = Math.min(index?.count ?? vertexCount, drawStart + drawCount);
  const unique = new Set<number>();
  const groups: Array<{ groupIndex: number; group: THREE.GeometryGroup }> = [];
  if (geometry.groups.length > 0) {
    for (const groupIndex of groupIndices) {
      const group = geometry.groups[groupIndex];
      if (group) groups.push({ groupIndex, group });
    }
  } else {
    groups.push({
      groupIndex: 0,
      group: { start: 0, count: index?.count ?? vertexCount, materialIndex: 0 },
    });
  }

  for (const { groupIndex, group } of groups) {
    if (!isRenderedOpaque(mesh, groupIndex)) continue;
    const start = Math.max(drawStart, group.start);
    const end = Math.min(drawEnd, group.start + group.count);
    for (let cursor = start; cursor + 2 < end; cursor += 3) {
      unique.add(index ? index.getX(cursor) : cursor);
      unique.add(index ? index.getX(cursor + 1) : cursor + 1);
      unique.add(index ? index.getX(cursor + 2) : cursor + 2);
    }
  }
  return [...unique];
}

function renderedVertices(mesh: THREE.Mesh, groupIndices: readonly number[]): THREE.Vector3[] {
  const vertex = new THREE.Vector3();
  return includedVertexIndices(mesh, groupIndices).map((vertexIndex) => {
    mesh.getVertexPosition(vertexIndex, vertex);
    return vertex.clone().applyMatrix4(mesh.matrixWorld);
  });
}

function principalAxis(vertices: readonly THREE.Vector3[]): THREE.Vector3 {
  if (vertices.length < 3) throw new Error("Rendered blade has fewer than three unique vertices");
  const centroid = new THREE.Vector3();
  for (const vertex of vertices) centroid.add(vertex);
  centroid.multiplyScalar(1 / vertices.length);

  const matrix = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const vertex of vertices) {
    const x = vertex.x - centroid.x;
    const y = vertex.y - centroid.y;
    const z = vertex.z - centroid.z;
    matrix[0]! += x * x;
    matrix[1]! += x * y;
    matrix[2]! += x * z;
    matrix[4]! += y * y;
    matrix[5]! += y * z;
    matrix[8]! += z * z;
  }
  const inverseCount = 1 / vertices.length;
  matrix[0]! *= inverseCount;
  matrix[1]! *= inverseCount;
  matrix[2]! *= inverseCount;
  matrix[3] = matrix[1]!;
  matrix[4]! *= inverseCount;
  matrix[5]! *= inverseCount;
  matrix[6] = matrix[2]!;
  matrix[7] = matrix[5]!;
  matrix[8]! *= inverseCount;
  const eigenvectors = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  const rotate = (p: number, q: number): void => {
    const pq = matrix[p * 3 + q]!;
    if (Math.abs(pq) <= Number.EPSILON) return;
    const pp = matrix[p * 3 + p]!;
    const qq = matrix[q * 3 + q]!;
    const theta = (qq - pp) / (2 * pq);
    const tangent = (theta >= 0 ? 1 : -1) /
      (Math.abs(theta) + Math.sqrt(theta * theta + 1));
    const cosine = 1 / Math.sqrt(tangent * tangent + 1);
    const sine = tangent * cosine;
    for (let row = 0; row < 3; row += 1) {
      if (row === p || row === q) continue;
      const rp = matrix[row * 3 + p]!;
      const rq = matrix[row * 3 + q]!;
      matrix[row * 3 + p] = cosine * rp - sine * rq;
      matrix[p * 3 + row] = matrix[row * 3 + p]!;
      matrix[row * 3 + q] = sine * rp + cosine * rq;
      matrix[q * 3 + row] = matrix[row * 3 + q]!;
    }
    matrix[p * 3 + p] = cosine * cosine * pp - 2 * sine * cosine * pq + sine * sine * qq;
    matrix[q * 3 + q] = sine * sine * pp + 2 * sine * cosine * pq + cosine * cosine * qq;
    matrix[p * 3 + q] = 0;
    matrix[q * 3 + p] = 0;
    for (let row = 0; row < 3; row += 1) {
      const vp = eigenvectors[row * 3 + p]!;
      const vq = eigenvectors[row * 3 + q]!;
      eigenvectors[row * 3 + p] = cosine * vp - sine * vq;
      eigenvectors[row * 3 + q] = sine * vp + cosine * vq;
    }
  };

  for (let sweep = 0; sweep < 64; sweep += 1) {
    rotate(0, 1);
    rotate(0, 2);
    rotate(1, 2);
  }
  let largest = 0;
  if (matrix[4]! > matrix[largest * 3 + largest]!) largest = 1;
  if (matrix[8]! > matrix[largest * 3 + largest]!) largest = 2;
  return new THREE.Vector3(
    eigenvectors[largest]!,
    eigenvectors[3 + largest]!,
    eigenvectors[6 + largest]!,
  ).normalize();
}

export function sampleRenderedBladeAxis(bindings: HeavyGeometryBindings): BladeAxisSample {
  const vertices = bindings.swordBladePrimitives.flatMap(({ mesh, materialGroupIndices }) =>
    renderedVertices(mesh, materialGroupIndices));
  const centroid = new THREE.Vector3();
  for (const vertex of vertices) centroid.add(vertex);
  centroid.multiplyScalar(1 / vertices.length);
  const axis = principalAxis(vertices);
  let minimum = Infinity;
  let maximum = -Infinity;
  for (const vertex of vertices) {
    const projection = vertex.clone().sub(centroid).dot(axis);
    minimum = Math.min(minimum, projection);
    maximum = Math.max(maximum, projection);
  }
  const first = centroid.clone().addScaledVector(axis, minimum);
  const second = centroid.clone().addScaledVector(axis, maximum);
  const grip = bindings.leftHandBone.getWorldPosition(new THREE.Vector3())
    .add(bindings.rightHandBone.getWorldPosition(new THREE.Vector3()))
    .multiplyScalar(0.5);
  return first.distanceToSquared(grip) <= second.distanceToSquared(grip)
    ? { guard: first, tip: second }
    : { guard: second, tip: first };
}

function targetHeight(bindings: HeavyGeometryBindings): number {
  let minimumY = Infinity;
  let maximumY = -Infinity;
  for (const mesh of bindings.targetSkinnedMeshes) {
    for (const vertex of renderedVertices(mesh, mesh.geometry.groups.length > 0
      ? mesh.geometry.groups.map((_, index) => index)
      : [0])) {
      minimumY = Math.min(minimumY, vertex.y);
      maximumY = Math.max(maximumY, vertex.y);
    }
  }
  const height = maximumY - minimumY;
  if (!Number.isFinite(height) || height <= 0) throw new Error("Rendered target height is invalid");
  return height;
}

function landmark(node: THREE.Object3D): THREE.Vector3 {
  return node.getWorldPosition(new THREE.Vector3());
}

function sampleCapsules(
  bindings: HeavyGeometryBindings,
  height: number,
): CapsuleSample[] {
  const bone = bindings.targetLandmarkBones;
  return [
    { id: "head", start: landmark(bone.neck), end: landmark(bone.head), radius: 0.08 * height },
    { id: "torso", start: landmark(bone.pelvis), end: landmark(bone.neck), radius: 0.115 * height },
    { id: "left-upper-arm", start: landmark(bone.leftShoulder), end: landmark(bone.leftElbow), radius: 0.05 * height },
    { id: "left-forearm", start: landmark(bone.leftElbow), end: landmark(bone.leftWrist), radius: 0.04 * height },
    { id: "right-upper-arm", start: landmark(bone.rightShoulder), end: landmark(bone.rightElbow), radius: 0.05 * height },
    { id: "right-forearm", start: landmark(bone.rightElbow), end: landmark(bone.rightWrist), radius: 0.04 * height },
    { id: "left-thigh", start: landmark(bone.leftHip), end: landmark(bone.leftKnee), radius: 0.06 * height },
    { id: "left-shin", start: landmark(bone.leftKnee), end: landmark(bone.leftAnkle), radius: 0.047 * height },
    { id: "right-thigh", start: landmark(bone.rightHip), end: landmark(bone.rightKnee), radius: 0.06 * height },
    { id: "right-shin", start: landmark(bone.rightKnee), end: landmark(bone.rightAnkle), radius: 0.047 * height },
  ];
}

export function segmentDistanceSquared(
  firstStart: THREE.Vector3,
  firstEnd: THREE.Vector3,
  secondStart: THREE.Vector3,
  secondEnd: THREE.Vector3,
): number {
  const u = firstEnd.clone().sub(firstStart);
  const v = secondEnd.clone().sub(secondStart);
  const w = firstStart.clone().sub(secondStart);
  const a = u.dot(u);
  const b = u.dot(v);
  const c = v.dot(v);
  const d = u.dot(w);
  const e = v.dot(w);
  const denominator = a * c - b * b;
  let sNumerator: number;
  let sDenominator = denominator;
  let tNumerator: number;
  let tDenominator = denominator;
  if (denominator < 1e-15) {
    sNumerator = 0;
    sDenominator = 1;
    tNumerator = e;
    tDenominator = c;
  } else {
    sNumerator = b * e - c * d;
    tNumerator = a * e - b * d;
    if (sNumerator < 0) {
      sNumerator = 0;
      tNumerator = e;
      tDenominator = c;
    } else if (sNumerator > sDenominator) {
      sNumerator = sDenominator;
      tNumerator = e + b;
      tDenominator = c;
    }
  }
  if (tNumerator < 0) {
    tNumerator = 0;
    if (-d < 0) sNumerator = 0;
    else if (-d > a) sNumerator = sDenominator;
    else {
      sNumerator = -d;
      sDenominator = a;
    }
  } else if (tNumerator > tDenominator) {
    tNumerator = tDenominator;
    if (-d + b < 0) sNumerator = 0;
    else if (-d + b > a) sNumerator = sDenominator;
    else {
      sNumerator = -d + b;
      sDenominator = a;
    }
  }
  const sc = Math.abs(sNumerator) < 1e-15 ? 0 : sNumerator / sDenominator;
  const tc = Math.abs(tNumerator) < 1e-15 ? 0 : tNumerator / tDenominator;
  return w.addScaledVector(u, sc).addScaledVector(v, -tc).lengthSq();
}

function interpolate(from: THREE.Vector3, to: THREE.Vector3, amount: number): THREE.Vector3 {
  return new THREE.Vector3().lerpVectors(from, to, amount);
}

export class HeavyContactResolver {
  private previous: GeometrySample | null = null;
  private targetHeightMeters: number | null = null;
  private contacting = false;

  constructor(private readonly bindings: HeavyGeometryBindings) {}

  reset(): void {
    this.previous = null;
    this.targetHeightMeters = null;
    this.contacting = false;
  }

  prime(): void {
    this.targetHeightMeters = targetHeight(this.bindings);
    this.previous = this.sample();
    this.contacting = this.minimumStateSeparation(this.previous) <= HEAVY_CONTACT_EPSILON_METERS;
  }

  resolveTick(): HeavyContactTickReceipt {
    if (!this.targetHeightMeters || !this.previous) this.prime();
    const previous = this.previous!;
    const current = this.sample();
    let minimumSweepSeparationMeters = Infinity;
    let contactSubstep: number | null = null;
    let contactCapsuleID: string | null = null;
    for (let substep = 1; substep <= HEAVY_SWEEP_SUBSTEPS; substep += 1) {
      const amount = substep / HEAVY_SWEEP_SUBSTEPS;
      const bladeStart = interpolate(previous.blade.guard, current.blade.guard, amount);
      const bladeEnd = interpolate(previous.blade.tip, current.blade.tip, amount);
      for (let index = 0; index < current.capsules.length; index += 1) {
        const before = previous.capsules[index]!;
        const after = current.capsules[index]!;
        const targetStart = interpolate(before.start, after.start, amount);
        const targetEnd = interpolate(before.end, after.end, amount);
        const separation = Math.sqrt(segmentDistanceSquared(
          bladeStart,
          bladeEnd,
          targetStart,
          targetEnd,
        )) - (HEAVY_BLADE_RADIUS_METERS + after.radius);
        if (separation < minimumSweepSeparationMeters) minimumSweepSeparationMeters = separation;
        if (contactSubstep === null && separation <= HEAVY_CONTACT_EPSILON_METERS) {
          contactSubstep = substep;
          contactCapsuleID = after.id;
        }
      }
    }
    const stateSeparationMeters = this.minimumStateSeparation(current);
    const contactingAtEnd = stateSeparationMeters <= HEAVY_CONTACT_EPSILON_METERS;
    const risingContact = !this.contacting && contactSubstep !== null;
    this.contacting = contactingAtEnd;
    this.previous = current;
    return {
      stateSeparationMeters,
      minimumSweepSeparationMeters,
      contactingAtEnd,
      risingContact,
      contactSubstep,
      contactCapsuleID,
    };
  }

  private sample(): GeometrySample {
    return {
      blade: sampleRenderedBladeAxis(this.bindings),
      capsules: sampleCapsules(this.bindings, this.targetHeightMeters!),
    };
  }

  private minimumStateSeparation(sample: GeometrySample): number {
    let minimum = Infinity;
    for (const capsule of sample.capsules) {
      const separation = Math.sqrt(segmentDistanceSquared(
        sample.blade.guard,
        sample.blade.tip,
        capsule.start,
        capsule.end,
      )) - (HEAVY_BLADE_RADIUS_METERS + capsule.radius);
      minimum = Math.min(minimum, separation);
    }
    return minimum;
  }
}

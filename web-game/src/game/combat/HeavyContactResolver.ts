import * as THREE from "three";

export const HEAVY_CONTACT_EPSILON = 0.000001;
export const HEAVY_BLADE_RADIUS_METERS = 0.02;
export const HEAVY_CONTACT_SUBSTEPS = 4096;

export type HeavyTargetLandmark =
  | "pelvis" | "neck" | "head"
  | "leftShoulder" | "leftElbow" | "leftWrist"
  | "rightShoulder" | "rightElbow" | "rightWrist"
  | "leftHip" | "leftKnee" | "leftAnkle"
  | "rightHip" | "rightKnee" | "rightAnkle";

export interface HeavyGeometryBindings {
  scene: THREE.Scene;
  leftHandBone: THREE.Bone;
  rightHandBone: THREE.Bone;
  swordBladePrimitives: Array<{ mesh: THREE.Mesh; materialGroupIndices: number[] }>;
  targetSkinnedMeshes: THREE.SkinnedMesh[];
  targetLandmarkBones: Record<HeavyTargetLandmark, THREE.Bone>;
}

interface Segment {
  start: THREE.Vector3;
  end: THREE.Vector3;
}

interface Capsule extends Segment {
  id: string;
  radius: number;
}

interface GeometrySample {
  blade: Segment;
  capsules: Capsule[];
}

export interface HeavyContactResult {
  absoluteTick: number;
  substep: number;
  capsuleID: string;
  separationMeters: number;
  bladeClosestWorld: readonly [number, number, number];
  targetClosestWorld: readonly [number, number, number];
}

export interface HeavyContactTelemetry {
  schema: "p30.r012a.heavy-contact-resolver.v1";
  targetHeightMeters: number | null;
  stateSeparationMeters: number | null;
  firstContact: HeavyContactResult | null;
}

const CAPSULE_LAYOUT = [
  ["head", "neck", "head", 0.08],
  ["torso", "pelvis", "neck", 0.115],
  ["left-upper-arm", "leftShoulder", "leftElbow", 0.05],
  ["left-forearm", "leftElbow", "leftWrist", 0.04],
  ["right-upper-arm", "rightShoulder", "rightElbow", 0.05],
  ["right-forearm", "rightElbow", "rightWrist", 0.04],
  ["left-thigh", "leftHip", "leftKnee", 0.06],
  ["left-shin", "leftKnee", "leftAnkle", 0.047],
  ["right-thigh", "rightHip", "rightKnee", 0.06],
  ["right-shin", "rightKnee", "rightAnkle", 0.047],
] as const satisfies ReadonlyArray<readonly [string, HeavyTargetLandmark, HeavyTargetLandmark, number]>;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function closestSegmentSegment(
  first: Segment,
  second: Segment,
): {
  distance: number;
  first01: number;
  second01: number;
  firstPoint: THREE.Vector3;
  secondPoint: THREE.Vector3;
} {
  const d1 = first.end.clone().sub(first.start);
  const d2 = second.end.clone().sub(second.start);
  const r = first.start.clone().sub(second.start);
  const a = d1.dot(d1);
  const e = d2.dot(d2);
  const f = d2.dot(r);
  const zero = 1e-24;
  let s: number;
  let t: number;
  if (a <= zero && e <= zero) {
    s = 0;
    t = 0;
  } else if (a <= zero) {
    s = 0;
    t = clamp01(f / e);
  } else {
    const c = d1.dot(r);
    if (e <= zero) {
      t = 0;
      s = clamp01(-c / a);
    } else {
      const b = d1.dot(d2);
      const denominator = a * e - b * b;
      s = Math.abs(denominator) > zero ? clamp01((b * f - c * e) / denominator) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp01(-c / a);
      } else if (t > 1) {
        t = 1;
        s = clamp01((b - c) / a);
      }
    }
  }
  const firstPoint = first.start.clone().addScaledVector(d1, s);
  const secondPoint = second.start.clone().addScaledVector(d2, t);
  return {
    distance: firstPoint.distanceTo(secondPoint),
    first01: s,
    second01: t,
    firstPoint,
    secondPoint,
  };
}

function interpolateSegment(from: Segment, to: Segment, amount: number): Segment {
  return {
    start: from.start.clone().lerp(to.start, amount),
    end: from.end.clone().lerp(to.end, amount),
  };
}

function jacobiPrincipalAxis(vertices: readonly THREE.Vector3[]): THREE.Vector3 {
  const centroid = vertices.reduce(
    (sum, vertex) => sum.add(vertex),
    new THREE.Vector3(),
  ).multiplyScalar(1 / vertices.length);
  const matrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const vertex of vertices) {
    const d = vertex.clone().sub(centroid);
    const values = [d.x, d.y, d.z];
    for (let row = 0; row < 3; row += 1) {
      for (let column = row; column < 3; column += 1) {
        matrix[row]![column]! += values[row]! * values[column]!;
      }
    }
  }
  for (let row = 0; row < 3; row += 1) {
    for (let column = row; column < 3; column += 1) {
      matrix[row]![column]! /= vertices.length;
      matrix[column]![row] = matrix[row]![column]!;
    }
  }
  const eigenvectors = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const pivots = [[0, 1], [0, 2], [1, 2]] as const;
  for (let sweep = 0; sweep < 64; sweep += 1) {
    for (const [p, q] of pivots) {
      const apq = matrix[p]![q]!;
      if (apq === 0) continue;
      const tau = (matrix[q]![q]! - matrix[p]![p]!) / (2 * apq);
      const sign = tau < 0 ? -1 : 1;
      const tangent = sign / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
      const cosine = 1 / Math.sqrt(1 + tangent * tangent);
      const sine = tangent * cosine;
      const app = matrix[p]![p]!;
      const aqq = matrix[q]![q]!;
      matrix[p]![p] = app - tangent * apq;
      matrix[q]![q] = aqq + tangent * apq;
      matrix[p]![q] = 0;
      matrix[q]![p] = 0;
      for (let k = 0; k < 3; k += 1) {
        if (k === p || k === q) continue;
        const akp = matrix[k]![p]!;
        const akq = matrix[k]![q]!;
        matrix[k]![p] = cosine * akp - sine * akq;
        matrix[p]![k] = matrix[k]![p]!;
        matrix[k]![q] = sine * akp + cosine * akq;
        matrix[q]![k] = matrix[k]![q]!;
      }
      for (let k = 0; k < 3; k += 1) {
        const vkp = eigenvectors[k]![p]!;
        const vkq = eigenvectors[k]![q]!;
        eigenvectors[k]![p] = cosine * vkp - sine * vkq;
        eigenvectors[k]![q] = sine * vkp + cosine * vkq;
      }
    }
  }
  const values = [matrix[0]![0]!, matrix[1]![1]!, matrix[2]![2]!];
  const index = [0, 1, 2].sort((left, right) => values[right]! - values[left]! || left - right)[0]!;
  const axis = new THREE.Vector3(
    eigenvectors[0]![index]!,
    eigenvectors[1]![index]!,
    eigenvectors[2]![index]!,
  ).normalize();
  const components = [Math.abs(axis.x), Math.abs(axis.y), Math.abs(axis.z)];
  const dominant = [0, 1, 2].sort((left, right) => components[right]! - components[left]! || left - right)[0]!;
  if ([axis.x, axis.y, axis.z][dominant]! < 0) axis.multiplyScalar(-1);
  return axis;
}

function selectedVertexIndices(
  mesh: THREE.Mesh,
  materialGroupIndices: readonly number[],
): number[] {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute("position");
  const totalCount = geometry.index?.count ?? position.count;
  const groups = geometry.groups.length > 0
    ? geometry.groups
    : [{ start: 0, count: totalCount, materialIndex: 0 }];
  const result = new Set<number>();
  for (const groupIndex of materialGroupIndices) {
    const group = groups[groupIndex];
    if (!group) throw new Error(`Heavy blade material group is missing: ${groupIndex}`);
    const end = Math.min(group.start + group.count, totalCount);
    for (let offset = group.start; offset < end; offset += 1) {
      result.add(geometry.index ? geometry.index.getX(offset) : offset);
    }
  }
  return [...result];
}

function vectorTuple(value: THREE.Vector3): readonly [number, number, number] {
  return [value.x, value.y, value.z];
}

export class HeavyContactResolver {
  private readonly bladeVertexIndices: Array<{ mesh: THREE.Mesh; indices: number[] }>;
  private previous: GeometrySample | null = null;
  private targetHeight: number | null = null;
  private activeSerial: number | null = null;
  private firstContact: HeavyContactResult | null = null;
  private stateSeparation: number | null = null;

  constructor(private readonly bindings: HeavyGeometryBindings) {
    this.bladeVertexIndices = bindings.swordBladePrimitives.map((primitive) => ({
      mesh: primitive.mesh,
      indices: selectedVertexIndices(primitive.mesh, primitive.materialGroupIndices),
    }));
  }

  reset(): void {
    this.previous = null;
    this.targetHeight = null;
    this.activeSerial = null;
    this.firstContact = null;
    this.stateSeparation = null;
  }

  resolve(absoluteTick: number, heavyAttackSerial: number | null): HeavyContactResult | null {
    this.bindings.scene.updateMatrixWorld(true);
    if (this.targetHeight === null && absoluteTick >= 0) this.targetHeight = this.measureTargetHeight();
    const current = this.sampleGeometry();
    this.stateSeparation = this.minimumStateSeparation(current);
    if (heavyAttackSerial !== null && this.activeSerial !== heavyAttackSerial) {
      this.activeSerial = heavyAttackSerial;
      this.firstContact = null;
    }

    let result: HeavyContactResult | null = null;
    if (
      heavyAttackSerial !== null &&
      this.firstContact === null &&
      this.previous !== null
    ) {
      result = this.sweep(this.previous, current, absoluteTick);
      if (result) this.firstContact = result;
    }
    this.previous = current;
    return result;
  }

  telemetry(): HeavyContactTelemetry {
    return {
      schema: "p30.r012a.heavy-contact-resolver.v1",
      targetHeightMeters: this.targetHeight,
      stateSeparationMeters: this.stateSeparation,
      firstContact: this.firstContact ? structuredClone(this.firstContact) : null,
    };
  }

  private sampleGeometry(): GeometrySample {
    const vertices: THREE.Vector3[] = [];
    for (const { mesh, indices } of this.bladeVertexIndices) {
      for (const index of indices) {
        const vertex = new THREE.Vector3();
        mesh.getVertexPosition(index, vertex);
        vertices.push(vertex.applyMatrix4(mesh.matrixWorld));
      }
    }
    if (vertices.length < 3) throw new Error("Heavy blade geometry is empty");
    const centroid = vertices.reduce((sum, vertex) => sum.add(vertex), new THREE.Vector3())
      .multiplyScalar(1 / vertices.length);
    const axis = jacobiPrincipalAxis(vertices);
    let minimum = Infinity;
    let maximum = -Infinity;
    for (const vertex of vertices) {
      const projection = vertex.clone().sub(centroid).dot(axis);
      minimum = Math.min(minimum, projection);
      maximum = Math.max(maximum, projection);
    }
    const endpointA = centroid.clone().addScaledVector(axis, minimum);
    const endpointB = centroid.clone().addScaledVector(axis, maximum);
    const grip = this.bindings.leftHandBone.getWorldPosition(new THREE.Vector3())
      .add(this.bindings.rightHandBone.getWorldPosition(new THREE.Vector3()))
      .multiplyScalar(0.5);
    const blade = endpointA.distanceTo(grip) < endpointB.distanceTo(grip)
      ? { start: endpointA, end: endpointB }
      : { start: endpointB, end: endpointA };

    const height = this.targetHeight ?? this.measureTargetHeight();
    const capsules = CAPSULE_LAYOUT.map(([id, from, to, ratio]) => ({
      id,
      start: this.bindings.targetLandmarkBones[from].getWorldPosition(new THREE.Vector3()),
      end: this.bindings.targetLandmarkBones[to].getWorldPosition(new THREE.Vector3()),
      radius: ratio * height,
    }));
    return { blade, capsules };
  }

  private measureTargetHeight(): number {
    let minimum = Infinity;
    let maximum = -Infinity;
    for (const mesh of this.bindings.targetSkinnedMeshes) {
      const count = mesh.geometry.getAttribute("position").count;
      for (let index = 0; index < count; index += 1) {
        const vertex = new THREE.Vector3();
        mesh.getVertexPosition(index, vertex).applyMatrix4(mesh.matrixWorld);
        minimum = Math.min(minimum, vertex.y);
        maximum = Math.max(maximum, vertex.y);
      }
    }
    const height = maximum - minimum;
    if (!Number.isFinite(height) || height < 1.55 || height > 2.2) {
      throw new Error(`Heavy target render height is outside protocol bounds: ${height}`);
    }
    return height;
  }

  private minimumStateSeparation(sample: GeometrySample): number {
    let minimum = Infinity;
    for (const capsule of sample.capsules) {
      const closest = closestSegmentSegment(sample.blade, capsule);
      minimum = Math.min(minimum, closest.distance - (HEAVY_BLADE_RADIUS_METERS + capsule.radius));
    }
    return minimum;
  }

  private sweep(
    previous: GeometrySample,
    current: GeometrySample,
    absoluteTick: number,
  ): HeavyContactResult | null {
    for (let substep = 1; substep <= HEAVY_CONTACT_SUBSTEPS; substep += 1) {
      const amount = substep / HEAVY_CONTACT_SUBSTEPS;
      const blade = interpolateSegment(previous.blade, current.blade, amount);
      for (let index = 0; index < current.capsules.length; index += 1) {
        const from = previous.capsules[index]!;
        const to = current.capsules[index]!;
        const target = interpolateSegment(from, to, amount);
        const closest = closestSegmentSegment(blade, target);
        const separation = closest.distance - (HEAVY_BLADE_RADIUS_METERS + to.radius);
        if (separation <= HEAVY_CONTACT_EPSILON) {
          return {
            absoluteTick,
            substep,
            capsuleID: to.id,
            separationMeters: separation,
            bladeClosestWorld: vectorTuple(closest.firstPoint),
            targetClosestWorld: vectorTuple(closest.secondPoint),
          };
        }
      }
    }
    return null;
  }
}

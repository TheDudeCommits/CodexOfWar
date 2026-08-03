import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { EnemyState } from "../../src/game/simulation/types";
import type { AssetRegistry } from "../../src/render/loaders/AssetRegistry";
import {
  ENEMY_ARCHETYPE_STYLES,
  EnemyFieldView,
  sampleEnemyAttackPose,
  type EnemyAvatarView,
  type EnemyFieldEntityState,
} from "../../src/render/objects/EnemyFieldView";
import {
  sampleEnemyAttackClipTime01,
  type EnemyAuthoredAttackPresentation,
} from "../../src/render/objects/CharacterViews";

const EMPTY_ASSETS = {} as AssetRegistry;

class FakeZombieView implements EnemyAvatarView {
  readonly root = new THREE.Group();
  readonly updates: Array<{
    state: EnemyState;
    elapsed: number;
    attack?: EnemyAuthoredAttackPresentation;
  }> = [];
  disposeCalls = 0;

  constructor(
    geometry: THREE.BufferGeometry,
    sourceMaterial: THREE.Material,
  ) {
    const mesh = new THREE.Mesh(geometry, sourceMaterial);
    mesh.name = "fake-zombie-mesh";
    this.root.add(mesh);
  }

  update(
    state: EnemyState,
    elapsed: number,
    attack?: EnemyAuthoredAttackPresentation,
  ): void {
    this.updates.push({ state, elapsed, attack });
  }

  dispose(): void {
    this.disposeCalls += 1;
  }
}

interface Fixture {
  readonly field: EnemyFieldView;
  readonly avatars: FakeZombieView[];
  readonly sourceGeometry: THREE.BoxGeometry;
  readonly sourceMaterial: THREE.MeshStandardMaterial;
  disposeSources(): void;
}

function createFixture(maxPoolSize = 18): Fixture {
  const avatars: FakeZombieView[] = [];
  const sourceGeometry = new THREE.BoxGeometry(0.7, 1.8, 0.55);
  const sourceMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b947e,
    emissive: 0x070b06,
    emissiveIntensity: 0.1,
    opacity: 1,
  });
  const field = new EnemyFieldView(EMPTY_ASSETS, {
    maxPoolSize,
    createZombieView: () => {
      const avatar = new FakeZombieView(sourceGeometry, sourceMaterial);
      avatars.push(avatar);
      return avatar;
    },
  });
  return {
    field,
    avatars,
    sourceGeometry,
    sourceMaterial,
    disposeSources: () => {
      sourceGeometry.dispose();
      sourceMaterial.dispose();
    },
  };
}

function enemy(
  id: string,
  overrides: Partial<EnemyFieldEntityState> = {},
): EnemyFieldEntityState {
  return {
    id,
    archetype: "shambler",
    position: { x: 0, z: 0 },
    yaw: 0,
    health: 100,
    maxHealth: 100,
    phase: "active",
    motion: "idle",
    telegraph01: 0,
    alive: true,
    hitPulse01: 0,
    attackPhase: "none",
    attackProgress01: 0,
    contactProgress01: 1 / 3,
    ...overrides,
  };
}

function instanceRoot(field: EnemyFieldView, id: string): THREE.Object3D {
  const found = field.root.getObjectByName(`enemy-field.instance.${id}`);
  if (!found) throw new Error(`Missing test instance ${id}`);
  return found;
}

function namedVisibility(root: THREE.Object3D, name: string): boolean {
  const found = root.getObjectByName(name);
  if (!found) throw new Error(`Missing object ${name}`);
  return found.visible;
}

describe("EnemyFieldView horde presentation", () => {
  it("maps the native full-body clip monotonically through anticipation, contact, and recovery", () => {
    expect(sampleEnemyAttackClipTime01({
      phase: "anticipation",
      progress01: 1,
      contactProgress01: 1 / 3,
    })).toBeCloseTo(0.28, 8);
    expect(sampleEnemyAttackClipTime01({
      phase: "committed",
      progress01: 1 / 3,
      contactProgress01: 1 / 3,
    })).toBeCloseTo(0.58, 8);
    expect(sampleEnemyAttackClipTime01({
      phase: "recovery",
      progress01: 0,
      contactProgress01: 1 / 3,
    })).toBeCloseTo(0.78, 8);
  });

  it("gives bite, pounce, and slam distinct contact silhouettes at the exact hit beat", () => {
    const contacts = [
      ["shambler", 3 / 9],
      ["stalker", 6 / 13],
      ["brute", 5 / 12],
    ] as const;
    const signatures = new Set<string>();
    for (const [archetype, contact] of contacts) {
      const anticipation = sampleEnemyAttackPose(archetype, "anticipation", 1, contact);
      const strike = sampleEnemyAttackPose(archetype, "committed", contact, contact);
      const recovery = sampleEnemyAttackPose(archetype, "recovery", 0.5, contact);
      expect(strike.contactWeight).toBe(1);
      expect(strike).not.toEqual(anticipation);
      expect(recovery).not.toEqual(strike);
      signatures.add(JSON.stringify(strike));
    }
    expect(signatures.size).toBe(3);
  });

  it("passes phase and exact contact timing to the avatar while retaining hit reaction", () => {
    const fixture = createFixture();
    fixture.field.update([enemy("attacker", {
      archetype: "stalker",
      motion: "attack",
      attackPhase: "committed",
      attackProgress01: 6 / 13,
      contactProgress01: 6 / 13,
    })], 0.5);
    expect(fixture.avatars[0]!.updates.at(-1)!.attack).toEqual({
      phase: "committed",
      progress01: 6 / 13,
      contactProgress01: 6 / 13,
    });
    fixture.field.update([enemy("attacker", {
      archetype: "stalker",
      motion: "hit",
      hitPulse01: 1,
    })], 0.6);
    expect(fixture.avatars[0]!.updates.at(-1)!.state.motion).toBe("hit");
    fixture.field.dispose();
    fixture.disposeSources();
  });

  it("keeps the three archetype silhouettes and combat cues measurably distinct", () => {
    expect(ENEMY_ARCHETYPE_STYLES.shambler.accessory).toBe("none");
    expect(ENEMY_ARCHETYPE_STYLES.stalker.accessory).toBe("vanes");
    expect(ENEMY_ARCHETYPE_STYLES.brute.accessory).toBe("elite-armor");
    expect(ENEMY_ARCHETYPE_STYLES.stalker.tempo).toBeGreaterThan(
      ENEMY_ARCHETYPE_STYLES.shambler.tempo,
    );
    expect(ENEMY_ARCHETYPE_STYLES.brute.bodyScale[0]).toBeGreaterThan(1.25);
    expect(ENEMY_ARCHETYPE_STYLES.brute.lockHeight).toBeGreaterThan(
      ENEMY_ARCHETYPE_STYLES.stalker.lockHeight,
    );
    expect(new Set(Object.values(ENEMY_ARCHETYPE_STYLES).map((style) => style.accent)).size).toBe(
      3,
    );
  });

  it("presents twelve keyed enemies without per-frame avatar creation or shared material mutation", () => {
    const fixture = createFixture();
    const { field, avatars, sourceMaterial } = fixture;
    field.reserve(12);
    expect(field.snapshot).toMatchObject({ pooled: 12, createdSlots: 12, totalSlots: 12 });

    const states = Array.from({ length: 12 }, (_, index) =>
      enemy(`z-${index}`, {
        archetype: index % 3 === 0 ? "brute" : index % 3 === 1 ? "stalker" : "shambler",
        position: { x: index - 5.5, z: -(index % 4) * 1.5 },
        yaw: index * 0.13,
      }),
    );
    field.update(states, 0);
    field.update(states, 0.5);
    field.update(states, 1);

    expect(avatars).toHaveLength(12);
    expect(field.snapshot).toMatchObject({
      activeIds: states.map((state) => state.id).sort(),
      pooled: 0,
      createdSlots: 12,
      totalSlots: 12,
    });
    expect(field.root.children).toHaveLength(12);

    const liveMaterials = new Set<THREE.Material>();
    field.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || object.name !== "fake-zombie-mesh") return;
      const material = Array.isArray(object.material) ? object.material[0] : object.material;
      if (material) liveMaterials.add(material);
    });
    expect(liveMaterials.size).toBe(12);
    expect(liveMaterials.has(sourceMaterial)).toBe(false);
    expect(sourceMaterial.color.getHex()).toBe(0x8b947e);
    expect(sourceMaterial.emissive.getHex()).toBe(0x070b06);
    expect(sourceMaterial.opacity).toBe(1);

    field.dispose();
    fixture.disposeSources();
  });

  it("renders restrained attack arcs and readable stalker/brute accessories", () => {
    const fixture = createFixture();
    const { field } = fixture;
    const states = [
      enemy("plain", { telegraph01: 0 }),
      enemy("bite", {
        position: { x: 0, z: 2 },
        motion: "attack",
        telegraph01: 0.55,
      }),
      enemy("quick", {
        archetype: "stalker",
        position: { x: 2, z: -1 },
        yaw: 0.7,
        motion: "attack",
        telegraph01: 0.65,
      }),
      enemy("elite", {
        archetype: "brute",
        position: { x: -3, z: 2 },
        motion: "attack",
        telegraph01: 1,
      }),
    ];
    field.update(states, 0);
    field.update(states, 0.5);

    expect(field.inspect("plain")).toMatchObject({
      archetype: "shambler",
      targetable: true,
      telegraphVisible: false,
    });
    expect(field.inspect("quick")).toMatchObject({
      archetype: "stalker",
      targetable: true,
      telegraphVisible: true,
      telegraphForm: "telegraph.stalker-pounce-lane",
    });
    expect(field.inspect("elite")).toMatchObject({
      archetype: "brute",
      targetable: true,
      telegraphVisible: true,
      telegraphForm: "telegraph.brute-slam-segment",
    });
    expect(field.inspect("bite")).toMatchObject({
      archetype: "shambler",
      telegraphVisible: true,
      telegraphForm: "telegraph.shambler-bite-arc",
    });
    expect(field.inspect("elite")!.telegraphOpacity).toBeGreaterThan(
      field.inspect("quick")!.telegraphOpacity,
    );

    const quick = instanceRoot(field, "quick");
    expect(namedVisibility(quick, "enemy-field.stalker-vane-left")).toBe(true);
    expect(namedVisibility(quick, "enemy-field.stalker-vane-right")).toBe(true);
    expect(namedVisibility(quick, "enemy-field.brute-elite-halo")).toBe(false);
    const elite = instanceRoot(field, "elite");
    expect(namedVisibility(elite, "enemy-field.brute-shoulder-left")).toBe(true);
    expect(namedVisibility(elite, "enemy-field.brute-shoulder-right")).toBe(true);
    expect(namedVisibility(elite, "enemy-field.brute-elite-halo")).toBe(false);

    const telegraph = elite.getObjectByName("enemy-field.attack-telegraph");
    expect(telegraph).toBeInstanceOf(THREE.Mesh);
    const telegraphMaterial = (telegraph as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(telegraphMaterial).toMatchObject({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      toneMapped: true,
    });

    field.dispose();
    fixture.disposeSources();
  });

  it("returns a world-space lock anchor only while an enemy is targetable", () => {
    const fixture = createFixture();
    const { field } = fixture;
    field.update(
      [enemy("lock-me", { archetype: "brute", position: { x: 4, z: -3 }, yaw: 1.2 })],
      0,
    );
    expect(field.getLockTargetAnchor("lock-me")).toBeNull();
    field.update(
      [enemy("lock-me", { archetype: "brute", position: { x: 4, z: -3 }, yaw: 1.2 })],
      0.5,
    );
    field.root.updateMatrixWorld(true);
    const anchor = field.getLockTargetAnchor("lock-me");
    expect(anchor).not.toBeNull();
    const world = anchor!.getWorldPosition(new THREE.Vector3());
    expect(world.x).toBeCloseTo(4, 8);
    expect(world.y).toBeCloseTo(ENEMY_ARCHETYPE_STYLES.brute.lockHeight, 8);
    expect(world.z).toBeCloseTo(-3, 8);

    field.update(
      [
        enemy("lock-me", {
          archetype: "brute",
          position: { x: 4, z: -3 },
          phase: "dying",
          motion: "dead",
          alive: false,
          health: 0,
          telegraph01: 1,
        }),
      ],
      0.6,
    );
    expect(field.getLockTargetAnchor("lock-me")).toBeNull();
    expect(field.inspect("lock-me")).toMatchObject({
      targetable: false,
      telegraphVisible: false,
    });

    field.dispose();
    fixture.disposeSources();
  });

  it("fades removed ids into the pool and reuses the same object for a new id", () => {
    const fixture = createFixture();
    const { field, avatars } = fixture;
    field.update([enemy("old")], 0);
    field.update([enemy("old")], 0.5);
    const oldRootUuid = field.inspect("old")!.rootUuid;

    field.update([], 0.6);
    expect(field.snapshot).toMatchObject({ activeIds: [], retiringIds: ["old"], pooled: 0 });
    expect(field.inspect("old")!.presentationOpacity).toBeGreaterThan(0);
    field.update([], 1.09);
    expect(field.inspect("old")).toBeNull();
    expect(field.snapshot).toMatchObject({ retiringIds: [], pooled: 1, createdSlots: 1 });

    field.update([enemy("new", { archetype: "stalker" })], 1.1);
    field.update([enemy("new", { archetype: "stalker" })], 1.5);
    expect(field.inspect("new")!.rootUuid).toBe(oldRootUuid);
    expect(field.snapshot).toMatchObject({ activeIds: ["new"], pooled: 0, createdSlots: 1 });
    expect(avatars).toHaveLength(1);

    field.dispose();
    fixture.disposeSources();
  });

  it("reclaims an id that returns during its exit without allocating a replacement", () => {
    const fixture = createFixture();
    const { field, avatars } = fixture;
    field.update([enemy("returning")], 0);
    field.update([enemy("returning")], 0.5);
    const rootUuid = field.inspect("returning")!.rootUuid;
    field.update([], 0.6);
    field.update([enemy("returning", { position: { x: 7, z: 1 } })], 0.72);
    field.update([enemy("returning", { position: { x: 7, z: 1 } })], 1.1);

    expect(field.snapshot).toMatchObject({
      activeIds: ["returning"],
      retiringIds: [],
      createdSlots: 1,
    });
    expect(field.inspect("returning")!.rootUuid).toBe(rootUuid);
    expect(avatars).toHaveLength(1);

    field.dispose();
    fixture.disposeSources();
  });

  it("maps hit/death presentation into ZombieView-compatible state and completes the fade", () => {
    const fixture = createFixture();
    const { field, avatars } = fixture;
    field.update([enemy("hurt", { motion: "hit", hitPulse01: 0.8, health: 35 })], 0);
    field.update([enemy("hurt", { motion: "hit", hitPulse01: 0.8, health: 35 })], 0.5);
    expect(avatars[0]!.updates.at(-1)!.state).toMatchObject({
      motion: "hit",
      health: 35,
      maxHealth: 100,
    });
    expect(avatars[0]!.updates.at(-1)!.state.hitStunRemaining).toBeCloseTo(0.224, 8);
    const hurtRoot = instanceRoot(field, "hurt");
    const hurtBody = hurtRoot.children[0]!;
    expect(hurtBody.position.z).toBeCloseTo(0.128, 8);
    expect(hurtBody.rotation.x).toBeGreaterThan(0.15);
    const hurtMesh = hurtRoot.getObjectByName("fake-zombie-mesh") as THREE.Mesh;
    const hurtMaterial = hurtMesh.material as THREE.MeshStandardMaterial;
    expect(hurtMaterial.emissiveIntensity).toBeLessThan(0.5);
    expect(Math.max(hurtMaterial.color.r, hurtMaterial.color.g, hurtMaterial.color.b)).toBeLessThan(0.8);

    const dead = enemy("hurt", {
      phase: "dying",
      motion: "dead",
      alive: false,
      health: 0,
      telegraph01: 1,
    });
    field.update([dead], 0.6);
    expect(avatars[0]!.updates.at(-1)!.state.motion).toBe("dead");
    expect(field.inspect("hurt")).toMatchObject({
      targetable: false,
      telegraphVisible: false,
    });
    field.update([dead], 1.3);
    expect(field.inspect("hurt")!.presentationOpacity).toBe(0);

    field.dispose();
    fixture.disposeSources();
  });

  it("restores active and pooled GPU resources and disposes every slot exactly once", () => {
    const fixture = createFixture();
    const { field, avatars } = fixture;
    field.reserve(3);
    field.update([enemy("one"), enemy("two")], 0);
    field.update([enemy("one"), enemy("two")], 0.5);
    const mesh = instanceRoot(field, "one").getObjectByName("fake-zombie-mesh") as THREE.Mesh;
    const isolatedMaterial = mesh.material as THREE.Material;
    const materialVersion = isolatedMaterial.version;
    const position = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    const attributeVersion = position.version;

    field.restoreGpuResources();
    expect(isolatedMaterial.version).toBeGreaterThan(materialVersion);
    expect(position.version).toBeGreaterThan(attributeVersion);

    field.dispose();
    field.dispose();
    expect(avatars).toHaveLength(3);
    expect(avatars.every((avatar) => avatar.disposeCalls === 1)).toBe(true);
    expect(field.snapshot).toMatchObject({
      activeIds: [],
      retiringIds: [],
      pooled: 0,
      createdSlots: 3,
      disposedSlots: 3,
      totalSlots: 0,
    });
    expect(() => field.update([], 1)).toThrow("EnemyFieldView has been disposed");

    fixture.disposeSources();
  });

  it("fails before reconciliation when a frame contains duplicate ids", () => {
    const fixture = createFixture();
    const { field } = fixture;
    expect(() => field.update([enemy("same"), enemy("same")], 0)).toThrow(
      "EnemyFieldView received duplicate id: same",
    );
    expect(field.snapshot).toMatchObject({ activeIds: [], createdSlots: 0, totalSlots: 0 });

    field.dispose();
    fixture.disposeSources();
  });

  it("bounds the retained pool and destroys overflow instead of leaking slots", () => {
    const fixture = createFixture(1);
    const { field, avatars } = fixture;
    field.update([enemy("a"), enemy("b"), enemy("c")], 0);
    field.update([enemy("a"), enemy("b"), enemy("c")], 0.5);
    field.update([], 0.6);
    field.update([], 1.09);

    expect(field.snapshot).toMatchObject({
      activeIds: [],
      retiringIds: [],
      pooled: 1,
      createdSlots: 3,
      disposedSlots: 2,
      totalSlots: 1,
    });
    expect(avatars.filter((avatar) => avatar.disposeCalls === 1)).toHaveLength(2);
    field.dispose();
    expect(avatars.every((avatar) => avatar.disposeCalls === 1)).toBe(true);

    fixture.disposeSources();
  });
});

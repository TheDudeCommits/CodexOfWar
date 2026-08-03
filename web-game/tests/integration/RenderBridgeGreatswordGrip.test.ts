import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { PlayerState } from "../../src/game/simulation/types";
import type { ThirdPersonCamera } from "../../src/render/app/ThirdPersonCamera";
import { RenderBridge } from "../../src/render/adapters/RenderBridge";
import type { AssetRegistry } from "../../src/render/loaders/AssetRegistry";

function authoredHeroAssets(): AssetRegistry {
  const hero = new THREE.Group();
  const pelvis = new THREE.Group();
  const spine01 = new THREE.Group();
  const spine02 = new THREE.Group();
  const spine03 = new THREE.Group();
  const neck = new THREE.Group();
  const lowerArm = new THREE.Group();
  const supportHand = new THREE.Group();
  const leadHand = new THREE.Group();
  const weaponSocket = new THREE.Group();
  const leadFoot = new THREE.Group();
  const supportFoot = new THREE.Group();
  pelvis.name = "pelvis";
  spine01.name = "spine_01";
  spine02.name = "spine_02";
  spine03.name = "spine_03";
  neck.name = "neck_01";
  lowerArm.name = "lowerarm_l";
  supportHand.name = "hand_l";
  leadHand.name = "hand_r";
  weaponSocket.name = "weapon_socket";
  leadFoot.name = "foot_l";
  supportFoot.name = "foot_r";
  pelvis.add(spine01);
  spine01.add(spine02);
  spine02.add(spine03);
  spine03.add(neck, lowerArm, leadHand);
  lowerArm.add(supportHand);
  leadHand.add(weaponSocket);
  hero.add(pelvis, leadFoot, supportFoot);

  const weapon = new THREE.Group();
  const secondaryGrip = new THREE.Object3D();
  const contact = new THREE.Object3D();
  const tip = new THREE.Object3D();
  secondaryGrip.name = "GripSecondary";
  secondaryGrip.position.set(0.18, 0.62, 0.07);
  contact.name = "ContactMarker";
  contact.position.y = 1.1;
  tip.name = "BladeTip";
  tip.position.y = 1.5;
  weapon.add(secondaryGrip, contact, tip);

  const clips = ["Idle_Loop", "Walk_Loop", "Sprint_Loop", "Roll", "Sword_Regular_A"]
    .map((name) => new THREE.AnimationClip(name, 1, []));
  return {
    instantiate: () => null,
    instantiateWithAnimations: (key: string) => {
      if (key === "character.hero") return { scene: hero, animations: clips };
      if (key === "weapon.claymore") return { scene: weapon, animations: [] };
      return null;
    },
    getAnimations: () => [],
    getTexture: () => null,
  } as unknown as AssetRegistry;
}

const ATTACKING_PLAYER: PlayerState = {
  position: { x: 0, z: 0 },
  yaw: 0,
  health: 100,
  maxHealth: 100,
  stamina: 100,
  maxStamina: 100,
  motion: "attack",
  speed01: 0,
  attackElapsed: 0.25,
  attackFrame: 9,
  attackPhase: "active",
  attackSerial: 1,
  attackHasHit: false,
  dodgeRemaining: 0,
  dodgeDirection: { x: 0, z: -1 },
  invulnerableRemaining: 0,
};

describe("RenderBridge greatsword presentation", () => {
  it("solves the support hand against the final normal-attack weapon transform", () => {
    const scene = new THREE.Scene();
    const camera = { kickShake: () => undefined } as unknown as ThirdPersonCamera;
    const bridge = new RenderBridge(scene, camera, authoredHeroAssets(), 1);
    bridge.updateHorde(
      ATTACKING_PLAYER,
      [],
      {
        activeWeapon: "greatsword",
        specialCooldown01: 0,
        specialActive01: 0,
        elapsed: 0.25,
        actionKind: "normal",
        actionProgress01: 0.25,
      },
      0.25,
      1 / 60,
    );

    const supportHand = bridge.hero.root.getObjectByName("hand_l")!;
    const weapon = bridge.hero.root.getObjectByName("stormcage-two-hand-socket")!;
    const secondaryGrip = weapon.getObjectByName("GripSecondary")!;
    const supportWorld = supportHand.getWorldPosition(new THREE.Vector3());
    const gripWorld = secondaryGrip.getWorldPosition(new THREE.Vector3());

    expect(supportWorld.distanceTo(gripWorld)).toBeLessThan(1e-6);
    expect(weapon.scale.x).toBeCloseTo(0.52, 10);
    expect(weapon.rotation.x).toBeCloseTo(0.08 * Math.SQRT1_2, 10);
    expect(weapon.rotation.y).toBeCloseTo(0.54 + 1.45, 10);
    expect(weapon.rotation.z).toBeCloseTo(-0.65 * Math.SQRT1_2, 10);
    bridge.dispose();
  });
});

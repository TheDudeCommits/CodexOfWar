import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  WEAPON_PRESENTATION_SCALE,
  WEAPON_VISUAL_STYLE,
  WeaponLoadoutView,
} from "../../src/render/objects/WeaponLoadoutView";

function rigFixture(): {
  root: THREE.Group;
  socket: THREE.Group;
  leftHand: THREE.Group;
  rightHand: THREE.Group;
  greatsword: THREE.Group;
} {
  const root = new THREE.Group();
  const socket = new THREE.Group();
  const leftHand = new THREE.Group();
  const rightHand = new THREE.Group();
  const greatsword = new THREE.Group();
  socket.name = "weapon_socket";
  leftHand.name = "hand_l";
  rightHand.name = "hand_r";
  greatsword.name = "stormcage-two-hand-socket";
  socket.add(greatsword);
  root.add(socket, leftHand, rightHand);
  return { root, socket, leftHand, rightHand, greatsword };
}

describe("WeaponLoadoutView", () => {
  it("presents three visibly separate weapon identities on authored anchors", () => {
    const fixture = rigFixture();
    const loadout = new WeaponLoadoutView(fixture.root);

    expect(loadout.getActiveAnchors()).toEqual([fixture.greatsword]);
    loadout.update({
      activeWeapon: "katana",
      specialCooldown01: 0,
      specialActive01: 0,
      elapsed: 0,
    });
    expect(fixture.greatsword.visible).toBe(false);
    expect(loadout.getActiveAnchors().map((anchor) => anchor.name)).toEqual([
      "weapon-loadout.katana",
    ]);

    loadout.update({
      activeWeapon: "twin-blades",
      specialCooldown01: 0.5,
      specialActive01: 1,
      elapsed: 0.25,
    });
    expect(loadout.getActiveAnchors().map((anchor) => anchor.name).sort()).toEqual([
      "weapon-loadout.twinblades.left",
      "weapon-loadout.twinblades.right",
    ]);
    expect(WEAPON_VISUAL_STYLE.katana.accent).not.toBe(
      WEAPON_VISUAL_STYLE["twin-blades"].accent,
    );

    loadout.dispose();
    expect(fixture.greatsword.visible).toBe(true);
    expect(fixture.leftHand.getObjectByName("weapon-loadout.twinblades.left")).toBeUndefined();
    expect(fixture.rightHand.getObjectByName("weapon-loadout.twinblades.right")).toBeUndefined();
  });

  it("keeps every weapon inside a restrained hand-rig scale", () => {
    const fixture = rigFixture();
    const loadout = new WeaponLoadoutView(fixture.root);

    loadout.update({
      activeWeapon: "katana",
      specialCooldown01: 0,
      specialActive01: 0,
      elapsed: 0,
    });
    expect(loadout.getActiveAnchors()[0]!.scale.x).toBe(WEAPON_PRESENTATION_SCALE.katana);

    loadout.update({
      activeWeapon: "greatsword",
      specialCooldown01: 0,
      specialActive01: 0,
      elapsed: 0,
    });
    expect(fixture.greatsword.scale.x).toBe(WEAPON_PRESENTATION_SCALE.greatsword);

    loadout.update({
      activeWeapon: "twin-blades",
      specialCooldown01: 0,
      specialActive01: 0,
      elapsed: 0,
    });
    for (const anchor of loadout.getActiveAnchors()) {
      expect(anchor.scale.x).toBe(WEAPON_PRESENTATION_SCALE["twin-blades"]);
    }
    expect(Math.max(...Object.values(WEAPON_PRESENTATION_SCALE))).toBeLessThan(0.8);
    loadout.dispose();
  });

  it("gives forged loadouts materially different normal and special socket poses", () => {
    const fixture = rigFixture();
    const loadout = new WeaponLoadoutView(fixture.root);

    for (const activeWeapon of ["katana", "twin-blades"] as const) {
      loadout.update({
        activeWeapon,
        specialCooldown01: 0,
        specialActive01: 0,
        elapsed: 0.2,
        actionKind: "normal",
        actionProgress01: 0.5,
      });
      const normal = loadout.getActiveAnchors().map((anchor) => anchor.rotation.toArray());
      loadout.update({
        activeWeapon,
        specialCooldown01: 0,
        specialActive01: 1,
        elapsed: 0.2,
        actionKind: "special",
        actionProgress01: 0.5,
      });
      const special = loadout.getActiveAnchors().map((anchor) => anchor.rotation.toArray());
      expect(JSON.stringify(special)).not.toBe(JSON.stringify(normal));
    }

    const katana = fixture.root.getObjectByName("weapon-loadout.katana")!;
    const blade = katana.getObjectByName("Moonveil_Blade") as THREE.Mesh;
    const steel = blade.material as THREE.MeshStandardMaterial;
    expect(steel.color.getHex()).not.toBe(0xffffff);
    loadout.dispose();
  });

  it("leaves authored greatsword rotation under HeroView ownership", () => {
    const fixture = rigFixture();
    fixture.greatsword.rotation.set(0.12, 0.6, -0.08);
    const baseline = fixture.greatsword.rotation.clone();
    const loadout = new WeaponLoadoutView(fixture.root);
    loadout.update({
      activeWeapon: "greatsword",
      specialCooldown01: 0,
      specialActive01: 1,
      elapsed: 0.25,
      actionKind: "special",
      actionProgress01: 0.5,
    });
    expect(fixture.greatsword.rotation.toArray()).toEqual(baseline.toArray());

    loadout.update({
      activeWeapon: "greatsword",
      specialCooldown01: 0.8,
      specialActive01: 0,
      elapsed: 1,
      actionKind: "none",
      actionProgress01: 0,
    });
    expect(fixture.greatsword.rotation.toArray()).toEqual(baseline.toArray());

    loadout.update({
      activeWeapon: "katana",
      specialCooldown01: 0,
      specialActive01: 0,
      elapsed: 1.1,
    });
    expect(fixture.greatsword.rotation.toArray()).toEqual(baseline.toArray());
    loadout.dispose();
    expect(fixture.greatsword.rotation.toArray()).toEqual(baseline.toArray());
  });
});

import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
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
});

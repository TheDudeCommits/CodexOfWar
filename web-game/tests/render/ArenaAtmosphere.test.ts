import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createScene } from "../../src/render/app/createScene";
import type { AssetRegistry } from "../../src/render/loaders/AssetRegistry";
import { ArenaView } from "../../src/render/objects/ArenaView";

function authoredArenaAssets(): AssetRegistry {
  const textures = new Map<string, THREE.Texture>();
  return {
    instantiate: (key: string) => {
      if (!key.startsWith("environment.")) return null;
      const root = new THREE.Group();
      root.add(
        new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshStandardMaterial(),
        ),
      );
      return root;
    },
    instantiateWithAnimations: () => null,
    getAnimations: () => [],
    getTexture: (key: string) => {
      if (!key.startsWith("material.")) return null;
      let texture = textures.get(key);
      if (!texture) {
        texture = new THREE.Texture();
        textures.set(key, texture);
      }
      return texture;
    },
  } as unknown as AssetRegistry;
}

describe("Horde arena atmosphere", () => {
  it("closes the orbiting camera sightlines and adds authored atmosphere", () => {
    const arena = new ArenaView(authoredArenaAssets(), 4);
    arena.extendGroundForHorde();

    const dressing = arena.root.getObjectByName(
      "environment.horde-perimeter-and-atmosphere",
    );
    expect(dressing).toBeDefined();
    expect(
      dressing?.children.filter((child) => child.name.endsWith(".authored-instance")),
    ).toHaveLength(11);
    expect(
      dressing?.children.filter((child) => child.name.startsWith("horde-brazier-")),
    ).toHaveLength(4);
    expect(
      dressing?.children.filter((child) => child.name.startsWith("horde-perimeter-rubble-")),
    ).toHaveLength(34);
    expect(arena.root.getObjectByName("ashwake-falling-ash")).toBeDefined();

    const flame = arena.root.getObjectByName("horde-brazier-flame-0")!;
    const light = arena.root.getObjectByName("horde-brazier-light-0") as THREE.PointLight;
    arena.update(1.25);
    expect(flame.scale.y).toBeGreaterThan(0.8);
    expect(light.intensity).toBeGreaterThan(2);
    arena.dispose();
  });

  it("uses a graded sky and denser depth fog instead of a flat void", () => {
    const { scene, rig } = createScene();
    expect(scene.getObjectByName("AshwakeMythicGradientSky")).toBeInstanceOf(THREE.Mesh);
    expect(scene.fog).toBeInstanceOf(THREE.FogExp2);
    expect((scene.fog as THREE.FogExp2).density).toBeCloseTo(0.046, 6);
    rig.dispose();
  });
});

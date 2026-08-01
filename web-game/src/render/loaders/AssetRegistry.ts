import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

interface BaseAssetEntry {
  url: string;
  enabled: boolean;
}

interface GlbAssetEntry extends BaseAssetEntry {
  type: "glb";
  compression: "none" | "draco";
  scale: number;
}

interface TextureAssetEntry extends BaseAssetEntry {
  type: "texture";
  colorSpace: "srgb" | "linear";
  wrap: "repeat" | "clamp";
}

interface HdrAssetEntry extends BaseAssetEntry {
  type: "hdr";
}

type AssetEntry = GlbAssetEntry | TextureAssetEntry | HdrAssetEntry;

interface AssetManifest {
  version: number;
  conventions: Record<string, string>;
  assets: Record<string, AssetEntry>;
}

interface LoadedGlb {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

export interface AssetInstance {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

export interface RegistryLoadReceipt {
  schema: "gauntlet.asset-registry.v1";
  manifestVersion: number | null;
  enabled: string[];
  loaded: string[];
  failures: string[];
  complete: boolean;
}

export class AssetRegistry {
  private readonly loadedGlbs = new Map<string, LoadedGlb>();
  private readonly loadedTextures = new Map<string, THREE.Texture>();
  private readonly loadedHdrs = new Map<string, THREE.DataTexture>();
  private readonly environmentTargets: THREE.WebGLRenderTarget[] = [];
  private readonly dracoLoaders: DRACOLoader[] = [];
  private readonly loadingManager = new THREE.LoadingManager();
  private readonly failures: string[] = [];
  private manifest: AssetManifest | null = null;

  async preloadEnabled(): Promise<string[]> {
    const response = await fetch("/assets/manifest.json");
    if (!response.ok) throw new Error(`Asset manifest failed with ${response.status}`);
    this.manifest = (await response.json()) as AssetManifest;
    this.failures.length = 0;

    const tasks = Object.entries(this.manifest.assets)
      .filter(([, entry]) => entry.enabled)
      .map(async ([key, entry]) => {
        try {
          await this.loadEntry(key, entry);
        } catch (error) {
          this.failures.push(`${key}: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
    await Promise.all(tasks);
    this.failures.sort();
    return [...this.failures];
  }

  /** Preserves the original scene-only registry API. */
  instantiate(key: string): THREE.Group | null {
    return this.instantiateWithAnimations(key)?.scene ?? null;
  }

  /** SkeletonUtils gives every skinned instance an independent live skeleton. */
  instantiateWithAnimations(key: string): AssetInstance | null {
    const source = this.loadedGlbs.get(key);
    if (!source) return null;
    return {
      scene: clone(source.scene) as THREE.Group,
      animations: source.animations.map((clip) => clip.clone()),
    };
  }

  getAnimations(key: string): THREE.AnimationClip[] {
    return this.loadedGlbs.get(key)?.animations.map((clip) => clip.clone()) ?? [];
  }

  getTexture(key: string): THREE.Texture | null {
    return this.loadedTextures.get(key) ?? null;
  }

  createEnvironmentMap(key: string, renderer: THREE.WebGLRenderer): THREE.Texture | null {
    const source = this.loadedHdrs.get(key);
    if (!source) return null;
    const generator = new THREE.PMREMGenerator(renderer);
    generator.compileEquirectangularShader();
    const target = generator.fromEquirectangular(source);
    generator.dispose();
    this.environmentTargets.push(target);
    return target.texture;
  }

  get loadReceipt(): RegistryLoadReceipt {
    const enabled = Object.entries(this.manifest?.assets ?? {})
      .filter(([, entry]) => entry.enabled)
      .map(([key]) => key)
      .sort();
    const loaded = [
      ...this.loadedGlbs.keys(),
      ...this.loadedTextures.keys(),
      ...this.loadedHdrs.keys(),
    ].sort();
    return {
      schema: "gauntlet.asset-registry.v1",
      manifestVersion: this.manifestVersion,
      enabled,
      loaded,
      failures: [...this.failures],
      complete:
        this.failures.length === 0 &&
        enabled.length > 0 &&
        enabled.every((key) => loaded.includes(key)),
    };
  }

  get manifestVersion(): number | null {
    return this.manifest?.version ?? null;
  }

  dispose(): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    for (const source of this.loadedGlbs.values()) {
      source.scene.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        geometries.add(node.geometry);
        const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of nodeMaterials) {
          materials.add(material);
          for (const value of Object.values(material as unknown as Record<string, unknown>)) {
            if (value instanceof THREE.Texture) textures.add(value);
          }
        }
      });
    }
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    for (const texture of this.loadedTextures.values()) texture.dispose();
    for (const texture of this.loadedHdrs.values()) texture.dispose();
    for (const target of this.environmentTargets) target.dispose();
    for (const loader of this.dracoLoaders) loader.dispose();
    this.loadedGlbs.clear();
    this.loadedTextures.clear();
    this.loadedHdrs.clear();
    this.environmentTargets.length = 0;
    this.dracoLoaders.length = 0;
  }

  private async loadEntry(key: string, entry: AssetEntry): Promise<void> {
    if (entry.type === "glb") {
      const gltf = await this.createGlbLoader(entry).loadAsync(entry.url);
      gltf.scene.scale.setScalar(entry.scale);
      gltf.scene.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        node.castShadow = true;
        node.receiveShadow = true;
        node.frustumCulled = true;
      });
      this.loadedGlbs.set(key, {
        scene: gltf.scene,
        animations: gltf.animations.map((clip) => clip.clone()),
      });
      return;
    }

    if (entry.type === "texture") {
      const texture = await new THREE.TextureLoader(this.loadingManager).loadAsync(entry.url);
      texture.colorSpace = entry.colorSpace === "srgb" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      if (entry.wrap === "repeat") {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
      }
      texture.needsUpdate = true;
      this.loadedTextures.set(key, texture);
      return;
    }

    const hdr = await new RGBELoader(this.loadingManager).loadAsync(entry.url);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    this.loadedHdrs.set(key, hdr);
  }

  private createGlbLoader(entry: GlbAssetEntry): GLTFLoader {
    const loader = new GLTFLoader(this.loadingManager);
    if (entry.compression === "draco") {
      const draco = new DRACOLoader();
      draco.setDecoderPath("/draco/");
      loader.setDRACOLoader(draco);
      this.dracoLoaders.push(draco);
    }
    return loader;
  }
}

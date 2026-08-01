import * as THREE from "three";

export interface RendererLifecycle {
  onContextLost: () => void;
  onContextRestored: () => void;
}

export interface RendererOptions {
  preserveDrawingBuffer: boolean;
  pixelRatio: number;
  fixedSize?: { width: number; height: number };
}

export function createRenderer(
  host: HTMLElement,
  lifecycle: RendererLifecycle,
  options: RendererOptions,
): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    depth: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: options.preserveDrawingBuffer,
  });
  renderer.setPixelRatio(options.pixelRatio);
  renderer.setSize(
    options.fixedSize?.width ?? host.clientWidth,
    options.fixedSize?.height ?? host.clientHeight,
    false,
  );
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.id = "game-canvas";
  renderer.domElement.setAttribute("aria-label", "Ashwake combat arena");
  renderer.domElement.tabIndex = 0;

  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    lifecycle.onContextLost();
  });
  renderer.domElement.addEventListener("webglcontextrestored", lifecycle.onContextRestored);
  host.prepend(renderer.domElement);
  return renderer;
}

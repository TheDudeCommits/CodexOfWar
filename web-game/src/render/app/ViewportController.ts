import type * as THREE from "three";
import type { PostStack } from "../post/PostStack";

export class ViewportController {
  private readonly observer: ResizeObserver;

  constructor(
    private readonly host: HTMLElement,
    private readonly renderer: THREE.WebGLRenderer,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly post: PostStack,
    private readonly fixedSize?: { width: number; height: number; pixelRatio: number },
  ) {
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(host);
    window.addEventListener("resize", this.resize);
    this.resize();
  }

  dispose(): void {
    this.observer.disconnect();
    window.removeEventListener("resize", this.resize);
  }

  private readonly resize = (): void => {
    const width = this.fixedSize?.width ?? Math.max(1, this.host.clientWidth);
    const height = this.fixedSize?.height ?? Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.fixedSize?.pixelRatio ?? Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(width, height, false);
    this.post.setSize(width, height);
  };
}

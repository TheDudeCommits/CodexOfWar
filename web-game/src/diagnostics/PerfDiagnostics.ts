import type * as THREE from "three";
import type { PostStack } from "../render/post/PostStack";

export interface RuntimeMetrics {
  fps: number;
  simulationHz: number;
  drawCalls: number;
  triangles: number;
  frameMilliseconds: number;
  postMilliseconds: number;
  postEnabled: boolean;
}

export class PerfDiagnostics {
  private elapsed = 0;
  private frames = 0;
  private simulationSteps = 0;
  private lastFrameMilliseconds = 0;
  private metrics: RuntimeMetrics = {
    fps: 0,
    simulationHz: 0,
    drawCalls: 0,
    triangles: 0,
    frameMilliseconds: 0,
    postMilliseconds: 0,
    postEnabled: false,
  };

  sample(
    delta: number,
    fixedSteps: number,
    frameMilliseconds: number,
    renderer: THREE.WebGLRenderer,
    post: PostStack,
  ): RuntimeMetrics {
    this.elapsed += delta;
    this.frames += 1;
    this.simulationSteps += fixedSteps;
    this.lastFrameMilliseconds = frameMilliseconds;
    if (this.elapsed >= 0.35) {
      this.metrics = {
        fps: this.frames / this.elapsed,
        simulationHz: this.simulationSteps / this.elapsed,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        frameMilliseconds: this.lastFrameMilliseconds,
        postMilliseconds: post.lastRenderMilliseconds,
        postEnabled: post.enabled,
      };
      this.elapsed = 0;
      this.frames = 0;
      this.simulationSteps = 0;
    }
    return this.metrics;
  }

  get current(): RuntimeMetrics {
    return { ...this.metrics };
  }
}

import * as THREE from 'three';
import { cityUniforms } from './materials/cityUniforms';

const normal = new THREE.Vector3(0, 1, 0);
const tmpPos = new THREE.Vector3();
const tmpTarget = new THREE.Vector3();
const tmpUp = new THREE.Vector3();
const rotation = new THREE.Matrix4();

/**
 * Builds the camera that sees the scene mirrored by the street plane y = 0, the way three's
 * Reflector does: reflected position, reflected aim and up, same projection.
 */
export function mirrorCamera(source: THREE.PerspectiveCamera, out: THREE.PerspectiveCamera): void {
  source.updateMatrixWorld();
  tmpPos.setFromMatrixPosition(source.matrixWorld);
  rotation.extractRotation(source.matrixWorld);
  tmpTarget.set(0, 0, -1).applyMatrix4(rotation).add(tmpPos);
  tmpUp.set(0, 1, 0).applyMatrix4(rotation);
  out.position.set(tmpPos.x, -tmpPos.y, tmpPos.z);
  tmpTarget.y = -tmpTarget.y;
  out.up.copy(tmpUp.reflect(normal));
  out.lookAt(tmpTarget);
  out.near = source.near;
  out.far = source.far;
  out.projectionMatrix.copy(source.projectionMatrix);
  out.projectionMatrixInverse.copy(source.projectionMatrixInverse);
  out.updateMatrixWorld();
}

export const reflectionActive = (enabled: boolean, wetness: number) => enabled && wetness > 0.02;

/**
 * Real reflections on wet streets (KTD2): the scene is rendered from the mirror camera into a
 * half-resolution, mipmapped target that road, ground and water sample projectively.
 */
export class PlanarReflection {
  private readonly target: THREE.WebGLRenderTarget;
  private readonly camera = new THREE.PerspectiveCamera();
  private readonly bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
    });
    cityUniforms.uReflection.value = this.target.texture;
  }

  /** Renders the mirrored scene, or disables reflections when not needed. */
  update(scene: THREE.Scene, camera: THREE.PerspectiveCamera, enabled: boolean, wetness: number, hide: THREE.Object3D[], shadowReady = true): void {
    if (!reflectionActive(enabled, wetness)) {
      cityUniforms.uReflectionOn.value = 0;
      return;
    }
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.max(1, Math.floor(size.x / 2));
    const h = Math.max(1, Math.floor(size.y / 2));
    if (this.target.width !== w || this.target.height !== h) this.target.setSize(w, h);

    mirrorCamera(camera, this.camera);
    cityUniforms.uReflectionMatrix.value.multiplyMatrices(this.bias, this.camera.projectionMatrix).multiply(this.camera.matrixWorldInverse);

    // The mirrored view must not sample itself or show the rain streaks, nor redo the shadow pass
    // (shadows are world-space, the main pass's map is valid) — except before the shadow map
    // exists: skipping it then would sample a missing map (sampler type mismatch).
    const shadowAuto = this.renderer.shadowMap.autoUpdate;
    if (shadowReady) this.renderer.shadowMap.autoUpdate = false;
    // Unbind the target while drawing into it (a sampled render target is a WebGL feedback loop).
    cityUniforms.uReflectionOn.value = 0;
    cityUniforms.uReflection.value = null;
    const visible = hide.map((o) => o.visible);
    hide.forEach((o) => (o.visible = false));
    const previous = this.renderer.getRenderTarget();
    try {
      this.renderer.setRenderTarget(this.target);
      this.renderer.clear();
      this.renderer.render(scene, this.camera);
    } finally {
      // Whatever happens, leave the renderer and the scene as they were.
      this.renderer.setRenderTarget(previous);
      this.renderer.shadowMap.autoUpdate = shadowAuto;
      hide.forEach((o, i) => (o.visible = visible[i]));
      cityUniforms.uReflection.value = this.target.texture;
    }
    cityUniforms.uReflectionOn.value = 1;
  }

  dispose(): void {
    this.target.dispose();
  }
}

/** GLSL shared by the street materials: projective lookup of the reflection texture. */
export const REFLECTION_VERTEX = {
  pars: `uniform mat4 uReflectionMatrix;
varying vec4 vReflectionUv;`,
  main: `vReflectionUv = uReflectionMatrix * modelMatrix * vec4(position, 1.0);`,
};

/** Adds the reflection to the emissive radiance; `sharpness` 0 = blurry asphalt, 1 = mirror puddle. */
export const reflectionFragment = (strength: string, sharpness: string, distortion: string) => `
{
  if (uReflectionOn > 0.5) {
    vec2 ruv = vReflectionUv.xy / vReflectionUv.w + ${distortion};
    float lod = mix(5.0, 0.3, ${sharpness});
    vec3 reflected = textureLod(uReflection, ruv, lod).rgb;
    float ndv = clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
    float fresnel = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
    float k = clamp((${strength}) * mix(0.35, 1.0, fresnel), 0.0, 1.0);
    totalEmissiveRadiance += reflected * k;
    diffuseColor.rgb *= 1.0 - k * 0.6;
  }
}`;

export const REFLECTION_FRAGMENT_PARS = `uniform sampler2D uReflection;
uniform float uReflectionOn;
varying vec4 vReflectionUv;`;

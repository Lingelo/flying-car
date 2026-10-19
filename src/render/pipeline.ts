import * as THREE from 'three';
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { QUALITY, pixelRatioFor, type QualityName } from '../settings/quality';

/**
 * Renderer, post-processing (bloom, SMAA, AgX tone mapping, vignette), sun shadows that follow
 * the player and an environment map regenerated from the sky when it changes (KTD10).
 */
export class RenderPipeline {
  readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private effectPasses: EffectPass[] = [];
  private aoPass: N8AOPostPass | null = null;
  private readonly pmrem: THREE.PMREMGenerator;
  private readonly envScene = new THREE.Scene();
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private envKey = '';
  quality: QualityName = 'high';

  constructor(
    container: HTMLElement,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly sun: THREE.DirectionalLight,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false, depth: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);
    this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType });
    // N8AOPostPass reuses this render and its depth (it does not redraw the scene).
    this.composer.addPass(new RenderPass(scene, camera));
    this.pmrem = new THREE.PMREMGenerator(this.renderer);

    sun.shadow.camera.left = -160;
    sun.shadow.camera.right = 160;
    sun.shadow.camera.top = 160;
    sun.shadow.camera.bottom = -160;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 1600;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.6;
    this.resize(container.clientWidth, container.clientHeight);
  }

  setQuality(name: QualityName): void {
    this.quality = name;
    const q = QUALITY[name];
    this.renderer.setPixelRatio(pixelRatioFor(name, window.devicePixelRatio || 1));
    const size = this.renderer.getSize(new THREE.Vector2());
    this.composer.setSize(size.x, size.y);

    this.sun.castShadow = q.shadows > 0;
    if (q.shadows > 0 && this.sun.shadow.mapSize.x !== q.shadows) {
      this.sun.shadow.mapSize.set(q.shadows, q.shadows);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }

    for (const pass of this.effectPasses) {
      this.composer.removePass(pass);
      pass.dispose();
    }
    if (this.aoPass) {
      this.composer.removePass(this.aoPass);
      this.aoPass.dispose();
      this.aoPass = null;
    }
    if (q.ao !== 'off') {
      // Ambient occlusion right after the scene render, before bloom and tone mapping.
      this.aoPass = new N8AOPostPass(this.scene, this.camera, size.x, size.y);
      Object.assign(this.aoPass.configuration, {
        aoRadius: 6,
        distanceFalloff: 1.5,
        intensity: 3.2,
        halfRes: q.ao === 'half',
        depthAwareUpsampling: true,
        gammaCorrection: false,
        transparencyAware: false,
      });
      this.aoPass.setQualityMode(q.ao === 'half' ? 'Low' : 'Medium');
      this.composer.addPass(this.aoPass);
    }
    // Convolution effects (SMAA) cannot share a pass with others.
    const effects = [];
    if (q.bloom) effects.push(new BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.82, luminanceSmoothing: 0.25, intensity: 1.15, radius: 0.72 }));
    effects.push(new VignetteEffect({ darkness: 0.55, offset: 0.3 }));
    effects.push(new ToneMappingEffect({ mode: ToneMappingMode.AGX }));
    this.effectPasses = [new EffectPass(this.camera, ...effects)];
    if (q.smaa) this.effectPasses.push(new EffectPass(this.camera, new SMAAEffect()));
    for (const pass of this.effectPasses) this.composer.addPass(pass);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Regenerates the environment map from the sky dome when the light changed noticeably
   * (every ~15 game minutes or on a weather change), then frames the sun shadow on `focus`.
   */
  update(dome: THREE.Mesh, hour: number, cloudiness: number, night: number, focus: THREE.Vector3): void {
    const key = `${Math.round(hour * 4)}:${Math.round(cloudiness * 8)}`;
    if (key !== this.envKey) {
      this.envKey = key;
      const copy = new THREE.Mesh(dome.geometry, dome.material);
      this.envScene.clear();
      this.envScene.add(copy);
      const target = this.pmrem.fromScene(this.envScene, 0.02, 1, 3000);
      this.envTarget?.dispose();
      this.envTarget = target;
      this.scene.environment = target.texture;
    }
    this.scene.environmentIntensity = 0.35 + 0.65 * (1 - night);

    // Daylight only: skip the shadow pass at night. Snap to texels to avoid shimmering.
    const daylight = this.sun.intensity > 0.15;
    this.sun.shadow.autoUpdate = daylight && this.sun.castShadow;
    // The shadow sampler needs a rendered depth map even at night.
    if (this.sun.castShadow && !this.sun.shadow.map) this.sun.shadow.needsUpdate = true;
    if (daylight) {
      const texel = 320 / Math.max(1, this.sun.shadow.mapSize.x);
      this.sun.target.position.set(Math.round(focus.x / texel) * texel, Math.round(focus.y / texel) * texel, Math.round(focus.z / texel) * texel);
      const dir = this.sun.position.clone().sub(focus).normalize();
      this.sun.position.copy(this.sun.target.position).addScaledVector(dir, 700);
      this.sun.target.updateMatrixWorld();
    }
  }

  /** True once the sun's shadow map exists (or shadows are off): other passes may skip it. */
  get shadowReady(): boolean {
    return !this.sun.castShadow || this.sun.shadow.map !== null;
  }

  render(dt: number): void {
    this.composer.render(dt);
  }
}

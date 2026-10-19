import * as THREE from 'three';

const FLASH_LIGHT = new THREE.Color(0.75, 0.82, 1);
const FLASH_SKY = new THREE.Color(0.45, 0.5, 0.7);
import { cityUniforms } from '../render/materials/cityUniforms';
import type { Environment } from './environment';
import { nightFactor, skyAt, sunDirection } from './time';

/** Gradient sky dome with sun and moon, plus the lights that go with it. */
export class SkyRig {
  readonly dome: THREE.Mesh;
  readonly sun = new THREE.DirectionalLight(0xffffff, 1);
  readonly moon = new THREE.DirectionalLight(0x8fa8ff, 0.25);
  readonly ambient = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
  readonly fogColor = new THREE.Color();
  private readonly uniforms = {
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3() },
    uSunColor: { value: new THREE.Color() },
    uNight: cityUniforms.uNight,
    uTime: cityUniforms.uTime,
    uCloudiness: { value: 0 },
    uSkyDetail: { value: 1 },
  };

  constructor(scene: THREE.Scene) {
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(2400, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: `varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`,
        fragmentShader: `uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uNight;
uniform float uTime;
uniform float uCloudiness;
uniform float uSkyDetail;
varying vec3 vDir;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) { v += amp * noise(p); p = p * 2.03 + vec2(1.7, 9.2); amp *= 0.5; }
  return v;
}
void main() {
  vec3 d = normalize(vDir);
  float up = max(d.y, 0.0);
  vec3 col = mix(uHorizon, uZenith, pow(up, 0.45));
  if (d.y < 0.0) col = uHorizon;
  // Sun disc and glow; the moon sits opposite.
  float s = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(s, 900.0) * 30.0 + pow(s, 12.0) * 0.35) * (1.0 - uNight);
  float m = max(dot(d, -uSunDir), 0.0);
  col += vec3(0.75, 0.8, 1.0) * (smoothstep(0.9993, 0.9996, m) * 2.0 + pow(m, 40.0) * 0.08) * uNight;
  // No stars: the smog over the city hides them.
  // Cloud deck: torn smog (domain-warped fBm) drifting with the wind, lit from below by the city.
  // Only above the horizon: below it the city covers the dome.
  if (up > 0.0) {
  vec2 cp = d.xz / max(d.y, 0.04) * 1.2;
  vec2 wind = vec2(uTime * 0.012, uTime * 0.004);
  // Low quality: no domain warp (two fBm fewer), no searchlights.
  vec2 warp = uSkyDetail > 0.5 ? vec2(fbm(cp * 0.8 + wind), fbm(cp * 0.8 + 5.2 - wind)) : vec2(0.0);
  float n = fbm(cp + warp * 1.6 + wind * 2.0);
  float cover = mix(0.62, 0.36, uCloudiness);
  float dens = smoothstep(cover, cover + 0.3, n);
  float detail = noise(cp * 4.0 + warp * 3.0 - wind * 3.0) * 0.6 + noise(cp * 9.0 + warp * 2.0) * 0.4;
  dens *= 0.7 + 0.4 * detail;
  float horizon = exp(-up * 3.0);
  // Light pollution: magenta and sodium orange, with a few cyan zones over the big screens.
  vec3 glow = mix(vec3(0.34, 0.1, 0.3), vec3(0.55, 0.22, 0.12), noise(cp * 0.12));
  glow = mix(glow, vec3(0.06, 0.2, 0.28), smoothstep(0.68, 0.92, noise(cp * 0.09 + 7.0)));
  vec3 cloudCol = uHorizon * 0.7 + glow * (0.18 + 0.8 * horizon) * uNight;
  // Thick cores darker, thin edges catching the glow.
  cloudCol *= mix(1.15, 0.5, smoothstep(0.45, 1.0, dens * (0.6 + 0.6 * detail)));
  // Searchlights sweeping the cloud base.
  for (int i = 0; i < 3; i++) {
    if (uSkyDetail < 0.5) break;
    float fi = float(i);
    float a = uTime * (0.07 + 0.03 * fi) + fi * 2.1;
    vec2 centre = vec2(cos(a), sin(a * 1.3)) * (2.5 + fi * 1.5);
    float spot = smoothstep(0.9, 0.0, length(cp - centre) / (0.35 + 0.1 * fi));
    cloudCol += vec3(0.5, 0.55, 0.7) * spot * 0.45 * uNight;
  }
  float show = smoothstep(0.0, 0.1, up) * (0.45 + 0.55 * uCloudiness);
  col = mix(col, cloudCol, dens * show);
  col += glow * exp(-up * 9.0) * 0.22 * uNight;
  // A few aircraft high up: a blinking red light gliding across the clear patches.
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 path = vec2(fract(uTime * 0.004 * (1.0 + fi * 0.3) + fi * 0.27) * 16.0 - 8.0, -3.0 + fi * 2.2);
    float lamp = smoothstep(0.035, 0.0, length(cp - path)) * step(0.6, fract(uTime * 0.8 + fi * 0.37));
    col += vec3(1.6, 0.2, 0.15) * lamp * (1.0 - dens) * uNight * step(0.15, up);
  }
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
      }),
    );
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -1;
    this.sun.castShadow = false;
    scene.add(this.dome, this.sun, this.sun.target, this.moon, this.moon.target, this.ambient);
  }

  /** Lightning: lights the sky, the ambient and the fog for a moment (flash in [0, 1]). */
  flash(flash: number, fog: THREE.FogExp2): void {
    if (flash <= 0) return;
    this.ambient.intensity += 4 * flash;
    this.ambient.color.lerp(FLASH_LIGHT, flash);
    this.uniforms.uZenith.value.lerp(FLASH_SKY, flash * 0.6);
    this.uniforms.uHorizon.value.lerp(FLASH_SKY, flash * 0.8);
    fog.color.lerp(FLASH_SKY, flash * 0.5);
  }

  /** Full smog clouds and searchlights, or a cheaper single-layer sky (low quality). */
  setDetail(on: boolean): void {
    this.uniforms.uSkyDetail.value = on ? 1 : 0;
  }

  setCloudiness(c: number): void {
    this.uniforms.uCloudiness.value = c;
  }

  /** Applies the environment around a focus point (the player). */
  update(env: Environment, focus: THREE.Vector3, camera: THREE.Camera, fog: THREE.FogExp2): void {
    const sky = skyAt(env.hour);
    const night = nightFactor(env.hour);
    const dir = sunDirection(env.hour);
    cityUniforms.uNight.value = night;
    this.uniforms.uZenith.value.setRGB(...sky.zenith);
    this.uniforms.uHorizon.value.setRGB(...sky.horizon);
    this.uniforms.uSunDir.value.set(dir.x, dir.y, dir.z);
    this.uniforms.uSunColor.value.setRGB(...sky.sunColor);
    this.dome.position.copy(camera.position);

    this.sun.color.setRGB(...sky.sunColor);
    this.sun.intensity = sky.sunIntensity;
    this.sun.position.set(focus.x + dir.x * 600, focus.y + dir.y * 600, focus.z + dir.z * 600);
    this.sun.target.position.copy(focus);
    this.moon.intensity = 0.35 * night;
    this.moon.position.set(focus.x - dir.x * 600, focus.y - dir.y * 600, focus.z - dir.z * 600);
    this.moon.target.position.copy(focus);
    this.ambient.color.setRGB(...sky.ambientSky);
    this.ambient.groundColor.setRGB(...sky.ambientGround);
    this.ambient.intensity = sky.ambientIntensity;
    this.fogColor.setRGB(...sky.horizon);
    fog.color.copy(this.fogColor);
  }
}

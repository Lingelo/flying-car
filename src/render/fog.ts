import * as THREE from 'three';

/** Thickness of the fog layer (m): streets are hazy, the view clears up above the towers. */
export const FOG_HEIGHT = 170;

/**
 * Replaces three's exponential fog with a height fog for every material (built-in or custom ones
 * that include the fog chunks). Must run before the first render.
 */
export function installHeightFog(): void {
  THREE.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogWorld;
#endif`;
  THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogWorld = (inverse(viewMatrix) * mvPosition).xyz;
#endif`;
  THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vFogWorld;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`;
  THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
  #ifdef FOG_EXP2
    // Optical depth of an exponential layer, integrated between the eye and the fragment heights.
    float fogY0 = max(cameraPosition.y, 0.0) / ${FOG_HEIGHT.toFixed(1)};
    float fogY1 = max(vFogWorld.y, 0.0) / ${FOG_HEIGHT.toFixed(1)};
    float fogDy = fogY1 - fogY0;
    float fogLayer = abs(fogDy) > 0.01 ? (exp(-fogY0) - exp(-fogY1)) / fogDy : exp(-fogY0);
    float fogOptical = fogDensity * vFogDepth * (0.22 + 0.78 * fogLayer) + pow(fogDensity * vFogDepth * 0.35, 2.0);
    float fogFactor = 1.0 - exp(-fogOptical);
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;
}

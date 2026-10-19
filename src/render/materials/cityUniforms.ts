import { Matrix4, type Texture } from 'three';

/** Uniforms shared by every city material, driven by time of day and weather. */
export const cityUniforms = {
  /** 0 = full day, 1 = full night: windows and neons light up. */
  uNight: { value: 1 },
  /** 0 = dry, 1 = soaked: surfaces get glossy. */
  uWetness: { value: 0 },
  /** Current rain intensity, for ripples in puddles. */
  uRain: { value: 0 },
  /** Moisture in the air (fog and rain): how much the neons bloom into halos. */
  uHaze: { value: 0 },
  uTime: { value: 0 },
  /** Planar reflection of the scene (high quality, wet streets). */
  uReflection: { value: null as Texture | null },
  uReflectionMatrix: { value: new Matrix4() },
  uReflectionOn: { value: 0 },
};

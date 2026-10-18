/** Uniforms shared by every city material, driven by time of day and weather. */
export const cityUniforms = {
  /** 0 = full day, 1 = full night: windows and neons light up. */
  uNight: { value: 1 },
  /** 0 = dry, 1 = soaked: surfaces get glossy. */
  uWetness: { value: 0 },
  /** Current rain intensity, for ripples in puddles. */
  uRain: { value: 0 },
  uTime: { value: 0 },
};

import * as THREE from 'three';
import manifest from './textureManifest.json';

export type TextureId = (typeof manifest.textures)[number]['id'];

export interface TextureSet {
  diff: THREE.Texture;
  nor: THREE.Texture;
  /** Ambient occlusion (R), roughness (G), metalness (B). */
  arm: THREE.Texture;
  /** Real-world size of one tile, in metres. */
  metres: number;
}

/** Every photo texture loaded so far, so the quality preset can retune their filtering. */
const loaded = new Set<THREE.Texture>();
let anisotropy = 16;

/** Anisotropic filtering of all photo textures (quality preset, capped by the GPU). */
export function setTextureAnisotropy(level: number): void {
  anisotropy = level;
  for (const t of loaded) {
    t.anisotropy = level;
    t.needsUpdate = true;
  }
}

export const texturePath = (id: string, map: string) => `assets/textures/${id}_${map}.jpg`;

type Loader = (url: string) => Promise<THREE.Texture>;
const defaultLoader: Loader = (url) => new THREE.TextureLoader().loadAsync(url);

/** Loads a CC0 texture set; null when any map is missing, so materials keep their procedural look (R10). */
export async function loadTextureSet(id: TextureId, load: Loader = defaultLoader): Promise<TextureSet | null> {
  const entry = manifest.textures.find((t) => t.id === id);
  if (!entry) return null;
  const base = typeof import.meta.env?.BASE_URL === 'string' ? import.meta.env.BASE_URL : '/';
  try {
    const [diff, nor, arm] = await Promise.all(manifest.maps.map((m) => load(`${base}${texturePath(id, m)}`)));
    for (const t of [diff, nor, arm]) {
      if (!(t instanceof THREE.Texture)) continue;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = anisotropy;
      loaded.add(t);
    }
    if (diff instanceof THREE.Texture) diff.colorSpace = THREE.SRGBColorSpace;
    return { diff, nor, arm, metres: entry.metres };
  } catch {
    return null;
  }
}

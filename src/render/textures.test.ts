import { describe, expect, it } from 'vitest';
import manifest from './textureManifest.json';
import { existsSync } from 'node:fs';
import { loadTextureSet, texturePath } from './textures';

describe('CC0 texture manifest', () => {
  it('lists only CC0 assets with a source and every map present on disk', () => {
    expect(manifest.license).toBe('CC0');
    for (const t of manifest.textures) {
      expect(t.polyhaven).toMatch(/^[a-z0-9_]+$/);
      expect(t.metres).toBeGreaterThan(0);
      for (const map of manifest.maps) expect(existsSync(`public/${texturePath(t.id, map)}`)).toBe(true);
    }
  });
});

describe('loadTextureSet', () => {
  it('falls back to null maps when a texture cannot be loaded (AE3)', async () => {
    const set = await loadTextureSet('panels', () => Promise.reject(new Error('404')));
    expect(set).toBeNull();
  });

  it('returns the three maps when they load', async () => {
    const loaded: string[] = [];
    const set = await loadTextureSet('panels', (url) => {
      loaded.push(url);
      return Promise.resolve({ url } as never);
    });
    expect(set).not.toBeNull();
    expect(loaded).toHaveLength(3);
    expect(loaded.every((u) => u.includes('panels'))).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { ATLAS_SIZE, atlasLayout, pickCell, SIGN_WORDS } from './signAtlas';

describe('sign atlas layout', () => {
  const cells = atlasLayout();

  it('gives every Japanese word its own cell', () => {
    for (const kind of ['vertical', 'banner', 'screen'] as const) {
      const words = cells.filter((c) => c.kind === kind).map((c) => c.word);
      expect(words.sort()).toEqual([...SIGN_WORDS[kind]].sort());
    }
  });

  it('keeps cells inside the atlas without overlapping', () => {
    for (const c of cells) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w).toBeLessThanOrEqual(ATLAS_SIZE);
      expect(c.y + c.h).toBeLessThanOrEqual(ATLAS_SIZE);
    }
    for (let i = 0; i < cells.length; i++)
      for (let j = i + 1; j < cells.length; j++) {
        const a = cells[i];
        const b = cells[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap).toBe(false);
      }
  });

  it('uses real Japanese text (kana or kanji) on every sign', () => {
    for (const c of cells) expect(c.word).toMatch(/[぀-ヿ一-龯]/);
  });

  it('picks the same cell for the same seed, matching the shader formula', () => {
    expect(pickCell('vertical', 0.42)).toEqual(pickCell('vertical', 0.42));
    const n = SIGN_WORDS.vertical.length;
    expect(pickCell('vertical', 0.999).word).toBe(SIGN_WORDS.vertical[n - 1]);
    expect(pickCell('banner', 0).word).toBe(SIGN_WORDS.banner[0]);
  });
});

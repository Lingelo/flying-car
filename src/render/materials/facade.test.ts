import { describe, expect, it } from 'vitest';
import { NEON_PALETTE, STYLE_COLUMN_WIDTH } from './facade';
import { DISTRICTS } from '../../city/districts';

describe('facade palette', () => {
  it('offers four distinct neon accents', () => {
    expect(new Set(NEON_PALETTE.map((c) => c.join())).size).toBe(4);
  });

  it('has a window column width for every building style, skywalks included', () => {
    // styles 0..3 come from the generator, 4 is used for skywalks
    expect(STYLE_COLUMN_WIDTH).toHaveLength(5);
    for (const w of STYLE_COLUMN_WIDTH) expect(w).toBeGreaterThan(1);
  });

  it('gives each district its own facade tint', () => {
    expect(new Set(Object.values(DISTRICTS).map((d) => d.facade.join())).size).toBe(4);
  });
});

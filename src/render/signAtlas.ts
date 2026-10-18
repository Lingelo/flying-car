import * as THREE from 'three';

export const ATLAS_SIZE = 2048;
export const ATLAS_FONT = '"Noto Sans JP"';

/** What the signs of Tokyo say: shops, districts, slogans. */
export const SIGN_WORDS = {
  // 32 vertical blades (128 × 512 px).
  vertical: [
    'ラーメン', '居酒屋', 'カラオケ', '寿司', '焼肉', '喫茶店', 'ホテル', '薬局',
    '漫画喫茶', '電気街', 'パチンコ', '営業中', '二十四時間', '歌舞伎町', '新宿', '渋谷',
    '秋葉原', '池袋', '夜の街', '電脳', '未来', '酒場', '焼鳥', '天ぷら',
    'うどん', '占い', '書店', '質屋', '整体', '宝石', '銀河', '夢',
  ],
  // 16 horizontal banners (512 × 128 px).
  banner: [
    'ネオン東京', 'サイバー通り', 'ようこそ', '新宿駅前', '電脳都市', '東京タワー', '未来銀行', 'ゲームセンター',
    '二十四時間営業', '酒処 居酒屋', 'ラーメン横丁', 'カプセルホテル', '夜間飛行', '空中都市', '高速道路', '渋谷交差点',
  ],
  // 8 giant screens (512 × 256 px).
  screen: ['未来へ飛べ', '東京二〇七七', '新発売', '夢を買う', '電脳サイダー', '空飛ぶ車', '夜を楽しめ', 'ネオンの夢'],
} as const;

export type SignCellKind = keyof typeof SIGN_WORDS;

export interface AtlasCell {
  kind: SignCellKind;
  word: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Regular grid, so the sign shader finds a cell from its index alone:
 * vertical 16 × 2 cells of 128 × 512 at the top, banners 4 × 4 of 512 × 128, screens 4 × 2 of 512 × 256.
 */
export function atlasLayout(): AtlasCell[] {
  const cells: AtlasCell[] = [];
  SIGN_WORDS.vertical.forEach((word, i) => cells.push({ kind: 'vertical', word, x: (i % 16) * 128, y: Math.floor(i / 16) * 512, w: 128, h: 512 }));
  SIGN_WORDS.banner.forEach((word, i) => cells.push({ kind: 'banner', word, x: (i % 4) * 512, y: 1024 + Math.floor(i / 4) * 128, w: 512, h: 128 }));
  SIGN_WORDS.screen.forEach((word, i) => cells.push({ kind: 'screen', word, x: (i % 4) * 512, y: 1536 + Math.floor(i / 4) * 256, w: 512, h: 256 }));
  return cells;
}

/** Cell used by a sign of this kind and seed; the shader computes the same index. */
export function pickCell(kind: SignCellKind, seed: number): AtlasCell {
  const words = SIGN_WORDS[kind];
  const index = Math.min(words.length - 1, Math.floor(seed * words.length));
  return atlasLayout().filter((c) => c.kind === kind)[index];
}

/** GLSL returning the atlas UV rect (x0, y0, x1, y1, origin top-left) of a cell, mirroring atlasLayout. */
export const ATLAS_GLSL = `
vec4 atlasCell(float kind, float seed) {
  // kind: 0 vertical, 1 banner, 2 screen
  float n = kind < 0.5 ? ${SIGN_WORDS.vertical.length.toFixed(1)} : kind < 1.5 ? ${SIGN_WORDS.banner.length.toFixed(1)} : ${SIGN_WORDS.screen.length.toFixed(1)};
  float i = min(n - 1.0, floor(seed * n));
  vec4 r;
  if (kind < 0.5) r = vec4(mod(i, 16.0) * 128.0, floor(i / 16.0) * 512.0, 128.0, 512.0);
  else if (kind < 1.5) r = vec4(mod(i, 4.0) * 512.0, 1024.0 + floor(i / 4.0) * 128.0, 512.0, 128.0);
  else r = vec4(mod(i, 4.0) * 512.0, 1536.0 + floor(i / 4.0) * 256.0, 512.0, 256.0);
  return vec4(r.xy, r.xy + r.zw) / ${ATLAS_SIZE.toFixed(1)};
}
// Sample at a local uv (0..1, y up) inside a cell; returns (crisp text, glow).
vec2 atlasText(sampler2D atlas, vec4 cell, vec2 uv) {
  vec2 p = vec2(mix(cell.x, cell.z, uv.x), mix(cell.w, cell.y, uv.y));
  return texture2D(atlas, p).rg;
}`;

/**
 * Draws every word with the bundled Noto Sans JP: red channel = crisp text, green = soft glow.
 * Waits for the font so no tofu boxes end up in the texture.
 */
export async function createSignAtlas(): Promise<THREE.CanvasTexture> {
  const cells = atlasLayout();
  const allText = cells.map((c) => c.word).join('');
  await Promise.all([document.fonts.load(`900 96px ${ATLAS_FONT}`, allText), document.fonts.load(`700 40px ${ATLAS_FONT}`, 'NEO TOKYO')]);
  // fonts.load resolves even when the font failed: check, so no tofu atlas is ever shown.
  if (!document.fonts.check(`900 96px ${ATLAS_FONT}`, allText)) throw new Error('Japanese font unavailable');
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalCompositeOperation = 'lighter';

  const draw = (fn: () => void) => {
    // Glow pass in green, then crisp pass in red.
    ctx.save();
    ctx.fillStyle = '#00ff00';
    ctx.shadowColor = '#00ff00';
    ctx.shadowBlur = 18;
    fn();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = '#ff0000';
    fn();
    ctx.restore();
  };

  for (const c of cells) {
    const chars = [...c.word];
    if (c.kind === 'vertical') {
      const size = Math.min(100, (c.h - 40) / chars.length);
      ctx.font = `900 ${size}px ${ATLAS_FONT}`;
      draw(() => chars.forEach((ch, i) => ctx.fillText(ch, c.x + c.w / 2, c.y + 20 + size * (i + 0.5))));
    } else if (c.kind === 'banner') {
      const size = Math.min(84, (c.w - 40) / chars.length);
      ctx.font = `900 ${size}px ${ATLAS_FONT}`;
      draw(() => ctx.fillText(c.word, c.x + c.w / 2, c.y + c.h / 2));
    } else {
      const size = Math.min(110, (c.w - 60) / chars.length);
      ctx.font = `900 ${size}px ${ATLAS_FONT}`;
      draw(() => ctx.fillText(c.word, c.x + c.w / 2, c.y + c.h * 0.42));
      ctx.font = `700 34px ${ATLAS_FONT}`;
      draw(() => ctx.fillText('NEO TOKYO 2077', c.x + c.w / 2, c.y + c.h * 0.8));
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  // Atlas coordinates follow the canvas (origin top-left).
  texture.flipY = false;
  texture.anisotropy = 8;
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

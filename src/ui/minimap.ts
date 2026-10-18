import type { Chunk } from '../city/generator';

export interface MinimapView {
  /** Player position and heading (the car faces (sin yaw, cos yaw)). */
  x: number;
  z: number;
  yaw: number;
  /** Pixels per metre. */
  scale: number;
  /** Canvas size in pixels (square). */
  size: number;
}

/** World (x, z) to minimap pixels: player at the centre, heading up. */
export function worldToMinimap(wx: number, wz: number, v: MinimapView): { x: number; y: number } {
  const dx = wx - v.x;
  const dz = wz - v.z;
  const forward = dx * Math.sin(v.yaw) + dz * Math.cos(v.yaw);
  const right = dx * -Math.cos(v.yaw) + dz * Math.sin(v.yaw);
  return { x: v.size / 2 + right * v.scale, y: v.size / 2 - forward * v.scale };
}

const DISTRICT_COLOURS: Record<Chunk['district'], string> = {
  downtown: 'rgba(120, 200, 255, 0.55)',
  neon: 'rgba(255, 80, 200, 0.5)',
  canals: 'rgba(120, 140, 255, 0.45)',
  industrial: 'rgba(255, 170, 80, 0.4)',
};

/** Round radar-style minimap drawn on a 2D canvas, at most 10 times per second. */
export class Minimap {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private lastDraw = 0;

  constructor(private readonly size = 190, private readonly scale = 0.32) {
    this.canvas = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = this.canvas.height = size * dpr;
    this.canvas.style.width = this.canvas.style.height = `${size}px`;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
  }

  draw(now: number, player: { x: number; z: number; yaw: number; y: number }, chunks: Iterable<Chunk>, traffic: { x: number; y: number; z: number; air: boolean }[]): void {
    if (now - this.lastDraw < 100) return;
    this.lastDraw = now;
    const { ctx, size } = this;
    const v: MinimapView = { x: player.x, z: player.z, yaw: player.yaw, scale: this.scale, size };
    const reach = size / 2 / this.scale + 40;
    ctx.save();
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(6, 4, 16, 0.78)';
    ctx.fillRect(0, 0, size, size);

    const poly = (corners: [number, number][]) => {
      ctx.beginPath();
      corners.forEach(([x, z], i) => {
        const p = worldToMinimap(x, z, v);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.fill();
    };
    for (const chunk of chunks) {
      if (Math.abs(chunk.origin.x + 128 - player.x) > reach + 128 || Math.abs(chunk.origin.z + 128 - player.z) > reach + 128) continue;
      ctx.fillStyle = 'rgba(70, 80, 120, 0.35)';
      for (const w of chunk.water) poly(rect(w.x, w.z, w.w, w.d));
      ctx.fillStyle = DISTRICT_COLOURS[chunk.district];
      for (const b of chunk.buildings) {
        const t = b.tiers[0];
        if (Math.abs(t.x - player.x) > reach || Math.abs(t.z - player.z) > reach) continue;
        // Buildings taller than the car are drawn solid, those below it fade.
        ctx.globalAlpha = b.height > player.y ? 1 : 0.35;
        poly(rect(t.x, t.z, t.w, t.d));
      }
      ctx.globalAlpha = 1;
    }
    for (const t of traffic) {
      const p = worldToMinimap(t.x, t.z, v);
      if (p.x < 0 || p.y < 0 || p.x > size || p.y > size) continue;
      ctx.fillStyle = t.air ? '#7ff6ff' : '#ffd27a';
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    // Player arrow.
    ctx.translate(size / 2, size / 2);
    ctx.fillStyle = '#ff3d8b';
    ctx.shadowColor = '#ff3d8b';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 7);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

const rect = (x: number, z: number, w: number, d: number): [number, number][] => [
  [x - w / 2, z - d / 2],
  [x + w / 2, z - d / 2],
  [x + w / 2, z + d / 2],
  [x - w / 2, z + d / 2],
];

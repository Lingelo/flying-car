import * as THREE from 'three';
import type { CarState } from '../vehicle/controller';

export interface PhotoHost {
  setPaused(paused: boolean): void;
  setHudHidden(hidden: boolean): void;
  /** Renders one frame right now, so the canvas holds a fresh image to read. */
  renderFrame(): void;
  toBlob(callback: (blob: Blob | null) => void): void;
  download(blob: Blob, name: string): void;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const photoFileName = (d: Date) =>
  `neon-city-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.png`;

const MIN_DISTANCE = 2.5;
const MAX_DISTANCE = 60;

/** Freezes the world, frees an orbiting camera around the car and saves screenshots (R21). */
export class PhotoMode {
  active = false;
  private readonly target = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0.25;
  private distance = 9;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly host: PhotoHost,
  ) {}

  enter(car: CarState): void {
    this.active = true;
    this.target.set(car.position.x, car.position.y + 1, car.position.z);
    // Start from behind the car, like the chase camera.
    this.yaw = car.yaw + Math.PI;
    this.pitch = 0.25;
    this.distance = 9;
    this.host.setPaused(true);
    this.host.setHudHidden(true);
  }

  exit(): void {
    this.active = false;
    this.host.setPaused(false);
    this.host.setHudHidden(false);
  }

  /** `look` in pixels (mouse / stick), `zoom` > 0 moves away. */
  update(look: { x: number; y: number }, zoom: number): void {
    if (!this.active) return;
    this.yaw -= look.x * 0.005;
    this.pitch = Math.max(-0.15, Math.min(1.45, this.pitch + look.y * 0.004));
    this.distance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, this.distance * (1 + zoom * 0.08)));
    const horizontal = Math.cos(this.pitch) * this.distance;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * horizontal,
      this.target.y + Math.sin(this.pitch) * this.distance,
      this.target.z + Math.cos(this.yaw) * horizontal,
    );
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
  }

  capture(): void {
    if (!this.active) return;
    this.host.renderFrame();
    this.host.toBlob((blob) => {
      if (blob) this.host.download(blob, photoFileName(new Date()));
    });
  }
}

/**
 * Reads the canvas synchronously, right after a render: without preserveDrawingBuffer the image
 * is only guaranteed within the same task, and an async toBlob can be starved by the render loop.
 */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Blob {
  const data = canvas.toDataURL('image/png');
  const bytes = atob(data.slice(data.indexOf(',') + 1));
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
  return new Blob([buffer], { type: 'image/png' });
}

/** Saves a blob through a temporary link. */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

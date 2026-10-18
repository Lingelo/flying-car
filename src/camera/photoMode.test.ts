import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PhotoMode, photoFileName } from './photoMode';
import { CarController } from '../vehicle/controller';

const setup = () => {
  const camera = new THREE.PerspectiveCamera();
  const events: string[] = [];
  const photo = new PhotoMode(camera, {
    setPaused: (p) => events.push(`paused:${p}`),
    setHudHidden: (h) => events.push(`hud:${h}`),
    renderFrame: () => events.push('render'),
    toBlob: (cb) => {
      events.push('toBlob');
      cb(new Blob(['png'], { type: 'image/png' }));
    },
    download: (_blob, name) => events.push(`download:${name.endsWith('.png')}`),
  });
  return { camera, photo, events };
};

describe('PhotoMode', () => {
  it('freezes the world and hides the HUD while active', () => {
    const { photo, events } = setup();
    photo.enter(new CarController().state);
    expect(photo.active).toBe(true);
    expect(events).toEqual(['paused:true', 'hud:true']);
    photo.exit();
    expect(photo.active).toBe(false);
    expect(events.slice(2)).toEqual(['paused:false', 'hud:false']);
  });

  it('captures a fresh frame as a PNG download (AE11)', () => {
    const { photo, events } = setup();
    photo.enter(new CarController().state);
    events.length = 0;
    photo.capture();
    expect(events).toEqual(['render', 'toBlob', 'download:true']);
  });

  it('does nothing when capturing outside photo mode', () => {
    const { photo, events } = setup();
    photo.capture();
    expect(events).toEqual([]);
  });

  it('orbits around the car and zooms within limits', () => {
    const { photo, camera } = setup();
    const state = new CarController({ x: 10, y: 0, z: 10 }).state;
    photo.enter(state);
    photo.update({ x: 0, y: 0 }, 0);
    const d0 = camera.position.distanceTo(new THREE.Vector3(10, 1, 10));
    photo.update({ x: 200, y: 0 }, 0);
    expect(camera.position.distanceTo(new THREE.Vector3(10, 1, 10))).toBeCloseTo(d0, 3);
    for (let i = 0; i < 100; i++) photo.update({ x: 0, y: 0 }, -1);
    expect(camera.position.distanceTo(new THREE.Vector3(10, 1, 10))).toBeGreaterThanOrEqual(2.5);
    const view = camera.getWorldDirection(new THREE.Vector3());
    const toCar = new THREE.Vector3(10, 1, 10).sub(camera.position).normalize();
    expect(view.dot(toCar)).toBeGreaterThan(0.99);
  });

  it('names photos with a timestamp', () => {
    expect(photoFileName(new Date(2026, 9, 18, 21, 5, 9))).toBe('neon-city-20261018-210509.png');
  });
});

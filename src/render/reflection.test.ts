import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { mirrorCamera, reflectionActive } from './reflection';

describe('mirrorCamera', () => {
  it('mirrors the camera below the street and aims at the mirrored target', () => {
    const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.3, 3000);
    cam.position.set(10, 8, -5);
    cam.lookAt(30, 2, 40);
    cam.updateMatrixWorld();
    const mirror = new THREE.PerspectiveCamera();
    mirrorCamera(cam, mirror);
    expect(mirror.position.x).toBeCloseTo(10);
    expect(mirror.position.y).toBeCloseTo(-8);
    expect(mirror.position.z).toBeCloseTo(-5);
    const dir = mirror.getWorldDirection(new THREE.Vector3());
    const expected = new THREE.Vector3(30, -2, 40).sub(mirror.position).normalize();
    expect(dir.dot(expected)).toBeGreaterThan(0.999);
    expect(mirror.projectionMatrix.equals(cam.projectionMatrix)).toBe(true);
  });
});

describe('reflectionActive', () => {
  it('only renders reflections on wet streets with the high preset', () => {
    expect(reflectionActive(true, 0.5)).toBe(true);
    expect(reflectionActive(true, 0)).toBe(false);
    expect(reflectionActive(false, 1)).toBe(false);
  });
});

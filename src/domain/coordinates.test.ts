import { describe, expect, it } from 'vitest';
import { clampPoint, fitViewport, isInside, toNormalized, toScreen, zoomAt } from './coordinates';

describe('normalized coordinates', () => {
  const image = { width: 1200, height: 800 };
  it('fits landscape images in portrait screens without stretching', () => {
    expect(fitViewport(image, { width: 360, height: 400 })).toEqual({ scale: 0.3, offset: { x: 0, y: 80 } });
  });
  it.each([{ width: 1440, height: 900 }, { width: 360, height: 400 }])('round-trips after pan and zoom on %o', container => {
    const fitted = fitViewport(image, container);
    const view = zoomAt(fitted, { x: 180, y: 160 }, fitted.scale * 2);
    view.offset.x -= 73;
    view.offset.y += 48;
    const point = { x: 0.23, y: 0.81 };
    const actual = toNormalized(toScreen(point, image, view), image, view);
    expect(actual.x).toBeCloseTo(point.x, 10);
    expect(actual.y).toBeCloseTo(point.y, 10);
  });
  it('preserves the map position under a zoom anchor', () => {
    const fitted = fitViewport(image, { width: 700, height: 500 });
    const anchor = { x: 237, y: 191 };
    const before = toNormalized(anchor, image, fitted);
    const after = toNormalized(anchor, image, zoomAt(fitted, anchor, fitted.scale * 3));
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });
  it('rejects placement in letterboxing and invalid points', () => {
    const fitted = fitViewport(image, { width: 360, height: 400 });
    expect(isInside(toNormalized({ x: 120, y: 30 }, image, fitted))).toBe(false);
    expect(isInside({ x: NaN, y: 0 })).toBe(false);
    expect(isInside({ x: 1, y: 0 })).toBe(true);
  });
  it('clamps drag positions at map edges', () => {
    expect(clampPoint({ x: -0.5, y: 1.5 })).toEqual({ x: 0, y: 1 });
  });
});

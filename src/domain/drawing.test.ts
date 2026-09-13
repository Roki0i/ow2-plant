import { expect, it } from 'vitest';
import { MAX_STROKE_POINTS, sampleStroke, simplifyStroke } from './drawing';
const screen = { width: 1000, height: 500 };
it('samples nearby points without allocating and bounds long input', () => {
  let points = [{ x: 0, y: 0 }];
  expect(sampleStroke(points, { x: 0.001, y: 0 }, screen)).toBe(points);
  for (let i = 0; i < 10000; i++) points = sampleStroke(points, { x: i % 2, y: 0 }, screen);
  expect(points).toHaveLength(MAX_STROKE_POINTS);
});
it('simplifies straight strokes while retaining endpoints and corners', () => {
  const points = Array.from({ length: 101 }, (_, i) => ({ x: i / 100, y: 0.5 }));
  expect(simplifyStroke(points, screen)).toEqual([points[0], points[100]]);
  const corner = [{ x: 0, y: 0 }, { x: 0.5, y: 1 }, { x: 1, y: 0 }];
  expect(simplifyStroke(corner, screen)).toEqual(corner);
});
it('keeps each original point within one screen pixel of the simplified polyline', () => {
  const points = Array.from({ length: 500 }, (_, i) => ({ x: i / 500, y: 0.5 + Math.sin(i / 30) * 0.2 }));
  const reduced = simplifyStroke(points, screen);
  expect(reduced.length).toBeLessThan(points.length / 4);
  for (const p of points) {
    const distances = reduced.slice(1).map((b, i) => {
      const a = reduced[i], dx = (b.x - a.x) * screen.width, dy = (b.y - a.y) * screen.height;
      const px = (p.x - a.x) * screen.width, py = (p.y - a.y) * screen.height;
      const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy)));
      return Math.hypot(px - t * dx, py - t * dy);
    });
    expect(Math.min(...distances)).toBeLessThanOrEqual(1.000001);
  }
});

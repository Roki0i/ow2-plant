import type { Point, Size } from './types';

export const MAX_STROKE_POINTS = 2048;
/** Online sampling in screen pixels, bounded even during very long gestures. */
export function sampleStroke(points: Point[], point: Point, screen: Size): Point[] {
  const last = points[points.length - 1];
  if (last && Math.hypot((last.x - point.x) * screen.width, (last.y - point.y) * screen.height) < 2) return points;
  if (points.length >= MAX_STROKE_POINTS) return points;
  return [...points, point];
}
/** Iterative Ramer–Douglas–Peucker; tolerance is measured in screen pixels. */
export function simplifyStroke(points: Point[], screen: Size, tolerance = 1): Point[] {
  if (points.length < 3) return points;
  const scaled = points.map(p => ({ x: p.x * screen.width, y: p.y * screen.height }));
  const keep = new Set([0, points.length - 1]);
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const start = scaled[a], end = scaled[b];
    const dx = end.x - start.x, dy = end.y - start.y;
    let max = tolerance * tolerance, index = -1;
    for (let i = a + 1; i < b; i++) {
      const p = scaled[i];
      const t = Math.max(0, Math.min(1, ((p.x - start.x) * dx + (p.y - start.y) * dy) / (dx * dx + dy * dy || 1)));
      const distance = (p.x - start.x - t * dx) ** 2 + (p.y - start.y - t * dy) ** 2;
      if (distance > max) { max = distance; index = i; }
    }
    if (index >= 0) { keep.add(index); stack.push([a, index], [index, b]); }
  }
  return [...keep].sort((a, b) => a - b).map(i => points[i]);
}

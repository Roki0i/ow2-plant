import type { NormalizedPoint, Point, Size, Viewport } from './types';

export function clampPoint(point: Point): NormalizedPoint {
  return { x: Math.max(0, Math.min(1, point.x)), y: Math.max(0, Math.min(1, point.y)) };
}

export function fitViewport(image: Size, container: Size): Viewport {
  const scale = Math.min(container.width / image.width, container.height / image.height);
  return { scale, offset: {
    x: (container.width - image.width * scale) / 2,
    y: (container.height - image.height * scale) / 2,
  } };
}

export function toScreen(point: NormalizedPoint, image: Size, view: Viewport): Point {
  return { x: point.x * image.width * view.scale + view.offset.x,
    y: point.y * image.height * view.scale + view.offset.y };
}

/** Does not clamp: callers can reject placement in letterboxing. */
export function toNormalized(point: Point, image: Size, view: Viewport): NormalizedPoint {
  return { x: (point.x - view.offset.x) / (image.width * view.scale),
    y: (point.y - view.offset.y) / (image.height * view.scale) };
}

export function isInside(point: NormalizedPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
    && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
}

export function zoomAt(view: Viewport, anchor: Point, scale: number): Viewport {
  const ratio = scale / view.scale;
  return { scale, offset: {
    x: anchor.x - (anchor.x - view.offset.x) * ratio,
    y: anchor.y - (anchor.y - view.offset.y) * ratio,
  } };
}

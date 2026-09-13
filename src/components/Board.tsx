import { useEffect, useRef, useState } from 'react';
import { Circle, Group, Image as CanvasImage, Layer, Stage, Text } from 'react-konva';
import type Konva from 'konva';
import { clampPoint, fitViewport, isInside, toNormalized, toScreen, zoomAt } from '../domain/coordinates';
import type { EditorTool, HeroElement, Point, Size, Viewport } from '../domain/types';
import { heroes } from '../data/catalog';

interface Props {
  image: HTMLImageElement;
  elements: HeroElement[];
  tool: EditorTool;
  onPlace: (point: Point) => void;
  onMove: (id: string, point: Point) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function Board({ image, elements, tool, onPlace, onMove, selectedId, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState<Size>({ width: 1, height: 1 });
  const [camera, setCamera] = useState({ zoom: 1, pan: { x: 0, y: 0 } });
  const panStart = useRef<{ point: Point; view: Viewport } | null>(null);
  const pinch = useRef<{ distance: number; center: Point; view: Viewport } | null>(null);
  const suppressTap = useRef(false);
  const dragged = useRef(false);
  const activeDrag = useRef<Konva.Group | null>(null);
  const cancelDrag = useRef(false);
  const imageSize = { width: image.naturalWidth, height: image.naturalHeight };
  const fitted = fitViewport(imageSize, size);
  const center = { x: size.width / 2, y: size.height / 2 };
  const zoomed = zoomAt(fitted, center, fitted.scale * camera.zoom);
  const view: Viewport = { scale: zoomed.scale, offset: {
    x: zoomed.offset.x + camera.pan.x, y: zoomed.offset.y + camera.pan.y,
  } };

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: Math.max(1, entry.contentRect.width), height: Math.max(1, entry.contentRect.height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function updateView(next: Viewport) {
    const zoom = next.scale / fitted.scale;
    const base = zoomAt(fitted, center, next.scale);
    setCamera({ zoom, pan: { x: next.offset.x - base.offset.x, y: next.offset.y - base.offset.y } });
  }
  function zoom(factor: number, anchor = center) {
    const scale = Math.max(fitted.scale, Math.min(fitted.scale * 5, view.scale * factor));
    updateView(zoomAt(view, anchor, scale));
  }
  function beginPan(point: Point | null) {
    if (tool === 'pan' && point) panStart.current = { point, view };
  }
  function movePan(point: Point | null) {
    const start = panStart.current;
    if (!point || !start) return;
    updateView({ ...start.view, offset: {
      x: start.view.offset.x + point.x - start.point.x,
      y: start.view.offset.y + point.y - start.point.y,
    } });
  }
  function place() {
    if (tool !== 'place' || suppressTap.current || dragged.current) return;
    const point = stageRef.current?.getPointerPosition();
    if (!point) return;
    const normalized = toNormalized(point, imageSize, view);
    if (isInside(normalized)) onPlace(normalized);
  }
  function touchPair(touches: TouchList) {
    const bounds = host.current!.getBoundingClientRect();
    return {
      distance: Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY),
      center: { x: (touches[0].clientX + touches[1].clientX) / 2 - bounds.left,
        y: (touches[0].clientY + touches[1].clientY) / 2 - bounds.top },
    };
  }

  return <section className="board-section" aria-label="戦術ボード">
    <div className="board" ref={host} data-testid="board" data-zoom={camera.zoom.toFixed(2)}
      style={{ cursor: tool === 'pan' ? 'grab' : tool === 'place' ? 'crosshair' : 'default' }}>
      <Stage ref={stageRef} width={size.width} height={size.height}
        onWheel={e => { e.evt.preventDefault(); zoom(e.evt.deltaY > 0 ? 0.9 : 1.1, e.target.getStage()!.getPointerPosition()!); }}
        onMouseDown={() => { dragged.current = false; suppressTap.current = false; beginPan(stageRef.current!.getPointerPosition()); }}
        onMouseMove={() => movePan(stageRef.current!.getPointerPosition())}
        onMouseUp={() => { panStart.current = null; }}
        onMouseLeave={() => { panStart.current = null; }}
        onClick={place} onTap={place}
        onTouchStart={e => {
          e.evt.preventDefault();
          if (e.evt.touches.length >= 2) {
            suppressTap.current = true;
            panStart.current = null;
            if (activeDrag.current) {
              cancelDrag.current = true;
              activeDrag.current.stopDrag();
              activeDrag.current = null;
            }
            pinch.current = { ...touchPair(e.evt.touches), view };
          } else {
            suppressTap.current = false;
            dragged.current = false;
            beginPan(stageRef.current!.getPointerPosition());
          }
        }}
        onTouchMove={e => {
          e.evt.preventDefault();
          if (e.evt.touches.length >= 2 && pinch.current) {
            const current = touchPair(e.evt.touches);
            const start = pinch.current;
            const scale = Math.max(fitted.scale, Math.min(fitted.scale * 5,
              start.view.scale * current.distance / Math.max(1, start.distance)));
            const next = zoomAt(start.view, start.center, scale);
            updateView({ ...next, offset: { x: next.offset.x + current.center.x - start.center.x,
              y: next.offset.y + current.center.y - start.center.y } });
          } else if (!suppressTap.current) movePan(stageRef.current!.getPointerPosition());
        }}
        onTouchEnd={e => {
          panStart.current = null;
          if (e.evt.touches.length < 2) pinch.current = null;
        }}
        onTouchCancel={() => {
          suppressTap.current = true;
          cancelDrag.current = true;
          activeDrag.current?.stopDrag();
          activeDrag.current = null;
          panStart.current = null;
          pinch.current = null;
        }}>
        <Layer>
          <CanvasImage image={image} x={view.offset.x} y={view.offset.y}
            width={imageSize.width * view.scale} height={imageSize.height * view.scale} />
          {elements.map(element => {
            const hero = heroes.find(h => h.id === element.heroId)!;
            const point = toScreen(element.position, imageSize, view);
            const color = element.team === 'ally' ? '#79ddd0' : '#ff9690';
            return <Group key={element.id} x={point.x} y={point.y}
              draggable={tool === 'select'}
              onClick={e => { e.cancelBubble = true; onSelect(element.id); }}
              onTap={e => { e.cancelBubble = true; onSelect(element.id); }}
              onDragStart={e => {
                dragged.current = true;
                cancelDrag.current = false;
                activeDrag.current = e.target as Konva.Group;
                onSelect(element.id);
              }}
              dragBoundFunc={pos => toScreen(clampPoint(toNormalized(pos, imageSize, view)), imageSize, view)}
              onDragEnd={e => {
                activeDrag.current = null;
                if (cancelDrag.current) { e.target.position(point); return; }
                onMove(element.id, clampPoint(toNormalized(e.target.position(), imageSize, view)));
              }}>
              <Circle radius={23} fill="#101820" stroke={color} strokeWidth={selectedId === element.id ? 4 : 2}
                dash={element.team === 'enemy' ? [5, 3] : undefined} shadowColor="#000" shadowBlur={8} shadowOpacity={0.3} />
              <Text text={hero.shortName} x={-23} y={-7} width={46} align="center" fontSize={14} fontStyle="bold" fill={color} listening={false} />
              <Text text={hero.name} x={-60} y={30} width={120} align="center" fontSize={12} fill="#f4f6f8" listening={false} />
            </Group>;
          })}
        </Layer>
      </Stage>
    </div>
    <div className="board-controls">
      <span>表示倍率 {Math.round(camera.zoom * 100)}%</span>
      <button aria-label="縮小" onClick={() => zoom(1 / 1.25)} disabled={camera.zoom <= 1.001}>−</button>
      <button aria-label="拡大" onClick={() => zoom(1.25)} disabled={camera.zoom >= 4.999}>＋</button>
      <button onClick={() => setCamera({ zoom: 1, pan: { x: 0, y: 0 } })}>全体表示</button>
    </div>
  </section>;
}

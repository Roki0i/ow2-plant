import { useEffect, useRef, useState } from 'react';
import { Arrow, Line, Circle, Group, Image as CanvasImage, Layer, Stage, Text } from 'react-konva';
import type Konva from 'konva';
import { clampPoint, fitViewport, isInside, toNormalized, toScreen, zoomAt } from '../domain/coordinates';
import type { BoardElement, EditorTool, HeroElement, Point, Size, Viewport } from '../domain/types';
import { MAX_STROKE_POINTS, sampleStroke, simplifyStroke } from '../domain/drawing';
import { heroes } from '../data/catalog';

interface Props {
  image: HTMLImageElement;
  elements: BoardElement[];
  drawingStyle: { color: string; width: number };
  onDraw: (element: Exclude<BoardElement, HeroElement>) => void;
  tool: EditorTool;
  onPlace: (point: Point) => void;
  onMove: (id: string, point: Point) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function Board({ image, elements, tool, onPlace, onMove, selectedId, onSelect, drawingStyle, onDraw }: Props) {
  const [draft, setDraft] = useState<Exclude<BoardElement, HeroElement> | null>(null);
  const draftRef = useRef<typeof draft>(null);
  const [limitReached, setLimitReached] = useState(false);
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

  function preview(next: typeof draft) { draftRef.current = next; setDraft(next); }
  function beginDrawing() {
    if (tool !== 'line' && tool !== 'arrow' && tool !== 'stroke') return;
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return;
    const point = toNormalized(pointer, imageSize, view);
    if (!isInside(point)) return;
    setLimitReached(false);
    const base = { id: crypto.randomUUID(), ...drawingStyle };
    preview(tool === 'stroke' ? { ...base, type: tool, points: [point] } : { ...base, type: tool, start: point, end: point });
  }
  function moveDrawing() {
    const current = draftRef.current, pointer = stageRef.current?.getPointerPosition();
    if (!current || !pointer || suppressTap.current) return;
    const point = clampPoint(toNormalized(pointer, imageSize, view));
    if (current.type === 'stroke') {
      const points = sampleStroke(current.points, point, { width: imageSize.width * view.scale, height: imageSize.height * view.scale });
      if (points.length >= MAX_STROKE_POINTS) setLimitReached(true);
      if (points !== current.points) preview({ ...current, points });
    } else preview({ ...current, end: point });
  }
  function finishDrawing() {
    const current = draftRef.current;
    preview(null);
    if (!current || suppressTap.current) return;
    const screen = { width: imageSize.width * view.scale, height: imageSize.height * view.scale };
    if (current.type === 'stroke') {
      const points = simplifyStroke(current.points, screen);
      if (points.length >= 2) onDraw({ ...current, points });
    } else if (Math.hypot((current.end.x - current.start.x) * screen.width, (current.end.y - current.start.y) * screen.height) >= 2) onDraw(current);
  }
  function select(id: string) { if (tool === 'select') onSelect(id); }
  function renderDrawing(element: Exclude<BoardElement, HeroElement>, pending = false) {
    const points = (element.type === 'stroke' ? element.points : [element.start, element.end])
      .flatMap(p => { const screen = toScreen(p, imageSize, view); return [screen.x, screen.y]; });
    const Shape = element.type === 'arrow' ? Arrow : Line;
    return <Shape key={element.id} points={points} stroke={element.color} fill={element.color} strokeWidth={element.width}
      lineCap="round" lineJoin="round" pointerLength={12 + element.width} pointerWidth={10 + element.width}
      hitStrokeWidth={Math.max(24, element.width)} listening={!pending && tool === 'select'}
      opacity={pending ? 0.7 : 1} shadowColor="#ffffff" shadowBlur={selectedId === element.id ? 8 : 0}
      onClick={e => { e.cancelBubble = true; select(element.id); }} onTap={e => { e.cancelBubble = true; select(element.id); }} />;
  }

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
      style={{ cursor: tool === 'pan' ? 'grab' : tool !== 'select' ? 'crosshair' : 'default' }}>
      <Stage ref={stageRef} width={size.width} height={size.height}
        onWheel={e => { e.evt.preventDefault(); if (draftRef.current) return; zoom(e.evt.deltaY > 0 ? 0.9 : 1.1, e.target.getStage()!.getPointerPosition()!); }}
        onMouseDown={() => { dragged.current = false; suppressTap.current = false; beginPan(stageRef.current!.getPointerPosition()); beginDrawing(); }}
        onMouseMove={() => { movePan(stageRef.current!.getPointerPosition()); moveDrawing(); }}
        onMouseUp={() => { panStart.current = null; moveDrawing(); finishDrawing(); }}
        onMouseLeave={() => { panStart.current = null; preview(null); }}
        onClick={e => { place(); if (tool === 'select' && !dragged.current && e.target.getClassName() === 'Image') onSelect(null); }} onTap={place}
        onTouchStart={e => {
          e.evt.preventDefault();
          if (e.evt.touches.length >= 2) {
            suppressTap.current = true;
            preview(null);
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
            beginDrawing();
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
          } else if (!suppressTap.current) { movePan(stageRef.current!.getPointerPosition()); moveDrawing(); }
        }}
        onTouchEnd={e => {
          if (!e.evt.touches.length) finishDrawing();
          panStart.current = null;
          if (e.evt.touches.length < 2) pinch.current = null;
        }}
        onTouchCancel={() => {
          preview(null);
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
          {elements.filter(e => e.type !== 'hero').map(e => renderDrawing(e))}
          {draft && renderDrawing(draft, true)}
          {elements.filter((e): e is HeroElement => e.type === 'hero').map(element => {
            const hero = heroes.find(h => h.id === element.heroId)!;
            const point = toScreen(element.position, imageSize, view);
            const color = element.team === 'ally' ? '#79ddd0' : '#ff9690';
            return <Group key={element.id} x={point.x} y={point.y}
              draggable={tool === 'select'}
              listening={tool === 'select'}
              onClick={e => { e.cancelBubble = true; select(element.id); }}
              onTap={e => { e.cancelBubble = true; select(element.id); }}
              onDragStart={e => {
                if (suppressTap.current) { cancelDrag.current = true; e.target.stopDrag(); return; }
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
    {limitReached && <p role="status" className="map-notice">1筆の上限に達しました。指を離して次の線を描いてください。</p>}
    <div className="board-controls">
      <span>表示倍率 {Math.round(camera.zoom * 100)}%</span>
      <button aria-label="縮小" onClick={() => zoom(1 / 1.25)} disabled={camera.zoom <= 1.001}>−</button>
      <button aria-label="拡大" onClick={() => zoom(1.25)} disabled={camera.zoom >= 4.999}>＋</button>
      <button onClick={() => setCamera({ zoom: 1, pan: { x: 0, y: 0 } })}>全体表示</button>
    </div>
  </section>;
}

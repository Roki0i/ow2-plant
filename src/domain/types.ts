export interface Point { x: number; y: number }
/** Image-relative coordinates. Each component is in [0, 1]. */
export type NormalizedPoint = Point;
export interface Size { width: number; height: number }
export type Team = 'ally' | 'enemy';
export type Side = 'attack' | 'defense' | 'common';
export type Role = 'tank' | 'damage' | 'support';

export interface HeroDefinition {
  id: string;
  name: string;
  shortName: string;
  role: Role;
}
export interface HeroElement {
  id: string;
  type: 'hero';
  heroId: string;
  team: Team;
  position: NormalizedPoint;
}
// Drawing data contracts only; editing/rendering is reserved for Phase 2.
export interface LineElement {
  id: string;
  type: 'line' | 'arrow';
  start: NormalizedPoint;
  end: NormalizedPoint;
  color: string;
  width: number;
}
export interface StrokeElement {
  id: string;
  type: 'stroke';
  points: NormalizedPoint[];
  color: string;
  width: number;
}
export type BoardElement = HeroElement | LineElement | StrokeElement;
export type MapImageSource =
  | { kind: 'original-demo'; url: string; revision: string }
  | { kind: 'local'; revision: string; fileName: string };
export interface MapArea extends Size {
  id: string;
  name: string;
  image: MapImageSource;
}
export interface MapDefinition {
  id: string;
  name: string;
  mode: 'hybrid' | 'escort' | 'control' | 'push' | 'flashpoint' | 'other';
  areas: MapArea[];
}
export interface Strategy {
  id: string;
  schemaVersion: 1;
  name: string;
  mapId: string;
  areaId: string;
  mapRevision: string;
  side: Side;
  elements: BoardElement[];
  createdAt: string;
  updatedAt: string;
}
export interface Viewport { scale: number; offset: Point }
export type EditorTool = 'select' | 'place' | 'pan';

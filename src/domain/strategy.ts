import { clampPoint, isInside } from './coordinates';
import type { BoardElement, HeroElement, NormalizedPoint, Strategy } from './types';

export type StrategyAction =
  | { type: 'draw'; element: Exclude<BoardElement, HeroElement>; at: string }
  | { type: 'delete'; id: string; at: string }
  | { type: 'style'; id: string; color: string; width: number; at: string }
  | { type: 'place'; element: HeroElement; at: string }
  | { type: 'move'; id: string; position: NormalizedPoint; at: string }
  | { type: 'rename'; name: string; at: string }
  | { type: 'side'; side: Strategy['side']; at: string }
  | { type: 'reset-map'; revision: string; at: string };

export function strategyReducer(state: Strategy, action: StrategyAction): Strategy {
  switch (action.type) {
    case 'draw': {
      const e = action.element;
      const points = e.type === 'stroke' ? e.points : [e.start, e.end];
      if (points.length < 2 || points.length > 2048 || !points.every(isInside) ||
        !/^#[0-9a-f]{6}$/i.test(e.color) || !Number.isFinite(e.width) || e.width < 1 || e.width > 12 ||
        state.elements.some(item => item.id === e.id)) return state;
      return { ...state, elements: [...state.elements, e], updatedAt: action.at };
    }
    case 'delete':
      if (!state.elements.some(e => e.id === action.id)) return state;
      return { ...state, elements: state.elements.filter(e => e.id !== action.id), updatedAt: action.at };
    case 'style': {
      const target = state.elements.find(e => e.id === action.id);
      if (!target || target.type === 'hero' || !/^#[0-9a-f]{6}$/i.test(action.color) ||
        !Number.isFinite(action.width) || action.width < 1 || action.width > 12 ||
        (target.color === action.color && target.width === action.width)) return state;
      return { ...state, updatedAt: action.at, elements: state.elements.map(e =>
        e.id === action.id ? { ...e, color: action.color, width: action.width } : e) };
    }
    case 'place':
      if (!isInside(action.element.position) || state.elements.some(e => e.id === action.element.id)) return state;
      return { ...state, elements: [...state.elements, action.element], updatedAt: action.at };
    case 'move': {
      if (!Number.isFinite(action.position.x) || !Number.isFinite(action.position.y)) return state;
      const target = state.elements.find(e => e.id === action.id && e.type === 'hero');
      if (!target || target.type !== 'hero') return state;
      const next = clampPoint(action.position);
      if (target.position.x === next.x && target.position.y === next.y) return state;
      return { ...state, updatedAt: action.at, elements: state.elements.map(e =>
        e.id === action.id && e.type === 'hero' ? { ...e, position: clampPoint(action.position) } : e) };
    }
    case 'rename': return { ...state, name: action.name, updatedAt: action.at };
    case 'side': return { ...state, side: action.side, updatedAt: action.at };
    case 'reset-map': return { ...state, elements: [], mapRevision: action.revision, updatedAt: action.at };
  }
}

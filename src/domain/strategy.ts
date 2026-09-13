import { clampPoint, isInside } from './coordinates';
import type { HeroElement, NormalizedPoint, Strategy } from './types';

export type StrategyAction =
  | { type: 'place'; element: HeroElement; at: string }
  | { type: 'move'; id: string; position: NormalizedPoint; at: string }
  | { type: 'rename'; name: string; at: string }
  | { type: 'side'; side: Strategy['side']; at: string }
  | { type: 'reset-map'; revision: string; at: string };

export function strategyReducer(state: Strategy, action: StrategyAction): Strategy {
  switch (action.type) {
    case 'place':
      if (!isInside(action.element.position) || state.elements.some(e => e.id === action.element.id)) return state;
      return { ...state, elements: [...state.elements, action.element], updatedAt: action.at };
    case 'move': {
      if (!Number.isFinite(action.position.x) || !Number.isFinite(action.position.y)) return state;
      const target = state.elements.find(e => e.id === action.id && e.type === 'hero');
      if (!target) return state;
      return { ...state, updatedAt: action.at, elements: state.elements.map(e =>
        e.id === action.id && e.type === 'hero' ? { ...e, position: clampPoint(action.position) } : e) };
    }
    case 'rename': return { ...state, name: action.name, updatedAt: action.at };
    case 'side': return { ...state, side: action.side, updatedAt: action.at };
    case 'reset-map': return { ...state, elements: [], mapRevision: action.revision, updatedAt: action.at };
  }
}

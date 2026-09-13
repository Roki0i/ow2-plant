import { strategyReducer, type StrategyAction } from './strategy';
import type { BoardElement, Strategy } from './types';

export const HISTORY_LIMIT = 100;
export interface History {
  present: Strategy;
  past: BoardElement[][];
  future: BoardElement[][];
}
export type HistoryAction = StrategyAction | { type: 'undo'; at: string } | { type: 'redo'; at: string };
export function createHistory(present: Strategy): History { return { present, past: [], future: [] }; }
export function historyReducer(state: History, action: HistoryAction): History {
  if (action.type === 'undo' || action.type === 'redo') {
    const source = action.type === 'undo' ? state.past : state.future;
    if (!source.length) return state;
    const present = { ...state.present, elements: source[source.length - 1], updatedAt: action.at };
    return action.type === 'undo'
      ? { present, past: state.past.slice(0, -1), future: [...state.future, state.present.elements] }
      : { present, past: [...state.past, state.present.elements].slice(-HISTORY_LIMIT), future: state.future.slice(0, -1) };
  }
  const present = strategyReducer(state.present, action);
  if (present === state.present) return state;
  // A different background cannot restore coordinates from the previous image.
  if (action.type === 'reset-map') return createHistory(present);
  if (present.elements === state.present.elements) return { ...state, present };
  return { present, past: [...state.past, state.present.elements].slice(-HISTORY_LIMIT), future: [] };
}

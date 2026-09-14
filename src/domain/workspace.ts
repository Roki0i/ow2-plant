import { createStrategy } from '../data/catalog';
import { createHistory, historyReducer, type History, type HistoryAction } from './history';
import { copyStrategy } from './persistence';
import type { Strategy } from './types';

export interface Workspace { entries: History[]; activeId: string }
export function createWorkspace(strategies: Strategy[]): Workspace {
  const entries = (strategies.length ? strategies : [createStrategy()]).map(createHistory);
  return { entries, activeId: entries[0].present.id };
}
export type WorkspaceAction = { type: 'edit'; action: HistoryAction } | { type: 'open'; id: string } | { type: 'add' | 'import'; strategy: Strategy } | { type: 'remove' };
export function workspaceReducer(state: Workspace, action: WorkspaceAction): Workspace {
  switch (action.type) {
    case 'open': return state.entries.some(e => e.present.id === action.id) ? { ...state, activeId: action.id } : state;
    case 'import': return workspaceReducer(state, { type: 'add', strategy: copyStrategy(action.strategy, state.entries.map(e => e.present)) });
    case 'add': return { entries: [...state.entries, createHistory(action.strategy)], activeId: action.strategy.id };
    case 'remove': {
      const entries = state.entries.filter(e => e.present.id !== state.activeId);
      return entries.length ? { entries, activeId: entries[0].present.id } : createWorkspace([]);
    }
    case 'edit': {
      const entries = state.entries.map(e => e.present.id === state.activeId ? historyReducer(e, action.action) : e);
      return entries.every((e, i) => e === state.entries[i]) ? state : { ...state, entries };
    }
  }
}

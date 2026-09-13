import { expect, it } from 'vitest';
import { createStrategy } from '../data/catalog';
import { createHistory, historyReducer, HISTORY_LIMIT } from './history';
import type { HeroElement, LineElement, StrokeElement } from './types';
const hero: HeroElement = { id: 'hero', type: 'hero', heroId: 'ana', team: 'ally', position: { x: 0.5, y: 0.5 } };
const line: LineElement = { id: 'line', type: 'line', start: { x: 0.1, y: 0.2 }, end: { x: 0.8, y: 0.7 }, color: '#79ddd0', width: 3 };
const initial = () => createHistory(createStrategy());
const placed = () => historyReducer(initial(), { type: 'place', element: hero, at: 't1' });
for (const element of [line, { ...line, type: 'arrow' as const }, { id: 'stroke', type: 'stroke', points: [line.start, line.end], color: line.color, width: 3 } satisfies StrokeElement]) {
  it(`creates ${element.type} with undo and redo`, () => {
    const drawn = historyReducer(initial(), { type: 'draw', element, at: 't1' });
    expect(drawn.present.elements).toEqual([element]);
    const undone = historyReducer(drawn, { type: 'undo', at: 't2' });
    expect(undone.present.elements).toEqual([]);
    expect(historyReducer(undone, { type: 'redo', at: 't3' }).present.elements).toEqual([element]);
  });
}
it('deletes, undoes and redoes', () => {
  const deleted = historyReducer(placed(), { type: 'delete', id: hero.id, at: 't2' });
  expect(deleted.present.elements).toEqual([]);
  const undone = historyReducer(deleted, { type: 'undo', at: 't3' });
  expect(undone.present.elements).toEqual([hero]);
  expect(historyReducer(undone, { type: 'redo', at: 't4' }).present.elements).toEqual([]);
});
it('undoes a completed hero drag in one operation', () => {
  const moved = historyReducer(placed(), { type: 'move', id: hero.id, position: { x: 0.8, y: 0.7 }, at: 't2' });
  expect(moved.past).toHaveLength(2);
  expect(historyReducer(moved, { type: 'undo', at: 't3' }).present.elements).toEqual([hero]);
});
it('discards redo after a new edit but preserves it for no-op edits', () => {
  const undone = historyReducer(placed(), { type: 'undo', at: 't2' });
  expect(historyReducer(undone, { type: 'delete', id: 'missing', at: 't3' })).toBe(undone);
  expect(historyReducer(undone, { type: 'draw', element: line, at: 't3' }).future).toEqual([]);
});
it('bounds history and undo stops at the oldest retained state', () => {
  let state = initial();
  for (let i = 0; i < HISTORY_LIMIT + 10; i++) state = historyReducer(state, { type: 'place', element: { ...hero, id: String(i) }, at: 't1' });
  expect(state.past).toHaveLength(HISTORY_LIMIT);
  for (let i = 0; i < HISTORY_LIMIT; i++) state = historyReducer(state, { type: 'undo', at: 't2' });
  expect(state.present.elements).toHaveLength(10);
  expect(historyReducer(state, { type: 'undo', at: 't3' })).toBe(state);
});
it('undoes color and width independently without copying stroke point arrays', () => {
  const drawn = historyReducer(initial(), { type: 'draw', element: line, at: 't1' });
  const color = historyReducer(drawn, { type: 'style', id: line.id, color: '#ffffff', width: 3, at: 't2' });
  const width = historyReducer(color, { type: 'style', id: line.id, color: '#ffffff', width: 6, at: 't3' });
  const undone = historyReducer(width, { type: 'undo', at: 't4' });
  expect(undone.present.elements).toEqual([{ ...line, color: '#ffffff' }]);
  expect(historyReducer(undone, { type: 'undo', at: 't5' }).present.elements).toEqual([line]);
});
it('background replacement clears both histories; metadata remains independent', () => {
  const renamed = historyReducer(placed(), { type: 'rename', name: 'new', at: 't2' });
  expect(renamed.past).toHaveLength(1);
  const undone = historyReducer(renamed, { type: 'undo', at: 't3' });
  expect(undone.present.name).toBe('new');
  const reset = historyReducer(undone, { type: 'reset-map', revision: 'local', at: 't4' });
  expect(reset.past).toEqual([]); expect(reset.future).toEqual([]);
});
it('rejects invalid drawings and ignores unchanged moves or styles', () => {
  const state = placed();
  expect(historyReducer(state, { type: 'move', id: hero.id, position: hero.position, at: 't2' })).toBe(state);
  expect(historyReducer(state, { type: 'draw', element: { ...line, width: Infinity }, at: 't2' })).toBe(state);
  expect(historyReducer(state, { type: 'draw', element: { ...line, start: { x: NaN, y: 0 } }, at: 't2' })).toBe(state);
  const drawn = historyReducer(state, { type: 'draw', element: line, at: 't2' });
  expect(historyReducer(drawn, { type: 'style', id: line.id, color: line.color, width: line.width, at: 't3' })).toBe(drawn);
});

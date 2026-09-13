import { describe, expect, it } from 'vitest';
import { strategyReducer } from './strategy';
import type { HeroElement, Strategy } from './types';

const state: Strategy = { id: 's1', schemaVersion: 1, name: 'Test', mapId: 'kings-row', areaId: 'point-a',
  mapRevision: 'demo-v1', side: 'attack', elements: [], createdAt: 't0', updatedAt: 't0' };
const element: HeroElement = { id: 'h1', type: 'hero', heroId: 'ana', team: 'enemy', position: { x: 0.2, y: 0.3 } };

describe('strategy editing', () => {
  it('places heroes immutably and keeps team and map identity', () => {
    const next = strategyReducer(state, { type: 'place', element, at: 't1' });
    expect(next.elements).toEqual([element]);
    expect(next.mapId).toBe('kings-row');
    expect(next.updatedAt).toBe('t1');
    expect(state.elements).toEqual([]);
  });
  it('rejects off-map placement and duplicate IDs', () => {
    expect(strategyReducer(state, { type: 'place', element: { ...element, position: { x: -1, y: 0 } }, at: 't1' })).toBe(state);
    const placed = { ...state, elements: [element] };
    expect(strategyReducer(placed, { type: 'place', element, at: 't1' })).toBe(placed);
  });
  it('moves just the target and clamps without changing the previous state', () => {
    const second = { ...element, id: 'h2' };
    const placed = { ...state, elements: [element, second] };
    const next = strategyReducer(placed, { type: 'move', id: 'h1', position: { x: 1.2, y: 0.7 }, at: 't2' });
    expect((next.elements[0] as HeroElement).position).toEqual({ x: 1, y: 0.7 });
    expect(next.elements[1]).toBe(second);
    expect(element.position).toEqual({ x: 0.2, y: 0.3 });
  });
  it('ignores missing targets and nonfinite moves', () => {
    const placed = { ...state, elements: [element] };
    expect(strategyReducer(placed, { type: 'move', id: 'missing', position: { x: 0, y: 0 }, at: 't1' })).toBe(placed);
    expect(strategyReducer(placed, { type: 'move', id: 'h1', position: { x: Infinity, y: 0 }, at: 't1' })).toBe(placed);
  });
  it('clears incompatible placements when the background changes', () => {
    const next = strategyReducer({ ...state, elements: [element] }, { type: 'reset-map', revision: 'local-v1', at: 't2' });
    expect(next.elements).toEqual([]);
    expect(next.mapRevision).toBe('local-v1');
  });
});

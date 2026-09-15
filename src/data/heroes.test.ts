import { expect, it } from 'vitest';
import { heroes, filterHeroes, roles } from './heroes';
import { createStrategy } from './catalog';
import { strategyReducer } from '../domain/strategy';
import { exportStrategy, importStrategy, saveStrategies, loadStrategies } from '../domain/persistence';

it('defines the complete 53 hero roster with unique stable IDs and labels', () => {
  expect(heroes).toHaveLength(53);
  expect(new Set(heroes.map(h => h.id)).size).toBe(heroes.length);
  for (const hero of heroes) {
    expect(roles).toContain(hero.role);
    expect(hero.id).toMatch(/^[a-z0-9-]+$/);
    expect(hero.name.length).toBeGreaterThan(0);
    expect(hero.shortLabel.length).toBeGreaterThan(0);
  }
  for (const id of ['reinhardt', 'winston', 'dva', 'tracer', 'genji', 'soldier-76', 'ana', 'lucio', 'mercy']) expect(heroes.some(h => h.id === id)).toBe(true);
});
it.each([[' LUCIO ', 'lucio'], ['D.Va', 'dva'], ['76', 'soldier-76'], ['Torbjorn', 'torbjorn'], ['jetpack', 'jetpack-cat']])('searches %s', (query, id) => {
  expect(filterHeroes(query).map(h => h.id)).toContain(id);
});
it.each(roles)('filters %s and combines search', role => {
  const found = filterHeroes('', role);
  expect(found.length).toBeGreaterThan(0);
  expect(found.every(h => h.role === role)).toBe(true);
  expect(filterHeroes('no such hero', role)).toEqual([]);
  expect(filterHeroes(found[0].name, role)).toContain(found[0]);
});
it.each(heroes)('places and round trips $name through JSON and persistence', hero => {
  const state = createStrategy();
  const placed = strategyReducer(state, { type: 'place', at: state.updatedAt, element: { id: 'placed', type: 'hero', heroId: hero.id, team: 'enemy', position: { x: .3, y: .7 } } });
  expect(placed.elements).toHaveLength(1);
  expect(importStrategy(exportStrategy(placed))).toEqual(placed);
  let raw = '';
  saveStrategies({ setItem: (_, value) => { raw = value; } }, [placed]);
  expect(loadStrategies({ getItem: () => raw })).toEqual([placed]);
});

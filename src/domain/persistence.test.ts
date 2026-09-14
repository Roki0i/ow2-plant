import { describe, expect, it } from 'vitest';
import { createStrategy } from '../data/catalog';
import { copyStrategy, exportStrategy, importStrategy, loadStrategies, saveStrategies, STORAGE_KEY, validateStrategy } from './persistence';
import { createWorkspace, workspaceReducer } from './workspace';

function fixture() {
  const s = createStrategy();
  s.elements = [
    { id: 'h', type: 'hero', heroId: 'ana', team: 'ally', position: { x: 0, y: 1 } },
    { id: 'l', type: 'line', start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, color: '#ffffff', width: 3 },
    { id: 'a', type: 'arrow', start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, color: '#ffffff', width: 12 },
    { id: 's', type: 'stroke', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: '#79ddd0', width: 1 },
  ];
  return s;
}
it('save and reload restores only Strategy data', () => {
  let json = '';
  const s = fixture();
  saveStrategies({ setItem: (key, value) => { expect(key).toBe(STORAGE_KEY); json = value; } }, [s]);
  expect(loadStrategies({ getItem: () => json })).toEqual([s]);
  for (const key of ['past', 'future', 'selection', 'zoom', 'pan', 'viewport']) expect(json).not.toContain(`"${key}"`);
});
it('JSON round trip is deterministic regardless of object key insertion order', () => {
  const s = fixture(); const json = exportStrategy(s);
  expect(importStrategy(json)).toEqual(s);
  expect(exportStrategy(Object.fromEntries(Object.entries(s).reverse()) as typeof s)).toBe(json);
});
it('duplicates deeply, renews strategy ID and retains independent elements', () => {
  const s = fixture(); const copy = copyStrategy(s, [s], true);
  expect(copy.id).not.toBe(s.id); expect(copy.name).toContain('コピー');
  copy.elements.pop(); expect(s.elements).toHaveLength(4);
});
it('imports collision safely and preserves noncolliding IDs', () => {
  const s = fixture(); expect(copyStrategy(s, []).id).toBe(s.id);
  expect(copyStrategy(s, [s]).id).not.toBe(s.id);
  const state = createWorkspace([s]); const next = workspaceReducer(state, { type: 'import', strategy: s });
  expect(next.entries[0]).toBe(state.entries[0]); expect(next.entries).toHaveLength(2);
  expect(next.activeId).not.toBe(s.id);
});
it('deletes selected strategy and creates empty replacement when deleting last', () => {
  const s = fixture(); const other = createStrategy();
  let state = workspaceReducer(createWorkspace([s, other]), { type: 'remove' });
  expect(state.entries.map(e => e.present)).toEqual([other]);
  state = workspaceReducer(state, { type: 'remove' });
  expect(state.entries).toHaveLength(1); expect(state.entries[0].present.elements).toEqual([]);
});
it('local background exports reference only and round trips', () => {
  const s = fixture(); s.mapRevision = 'local-test';
  expect(importStrategy(exportStrategy(s))).toEqual(s);
  expect(exportStrategy(s)).not.toMatch(/blob:|data:|base64/);
});
it.each(['{', 'NaN', '{"x":Infinity}', 'null', '[]'])('rejects invalid JSON/schema %s', json => {
  expect(() => importStrategy(json)).toThrow();
});
describe('strict schema validation', () => {
  it.each([
    { schemaVersion: undefined }, { schemaVersion: 2 }, { name: 1 }, { name: 'x'.repeat(81) },
    { side: 'invalid' }, { mapId: 'unknown' }, { areaId: 'unknown' }, { mapRevision: 'https://evil.test' },
    { createdAt: 'yesterday' }, { updatedAt: '2026-02-31T00:00:00.000Z' }, { past: [] }, { elements: [{}] },
  ])('rejects invalid fields %j', patch => expect(() => validateStrategy({ ...fixture(), ...patch })).toThrow());
  it.each([NaN, Infinity, -Infinity, -0.01, 1.01, '0.5', null])('rejects coordinate %s before serialization', x => {
    const s = fixture(); s.elements[0] = { ...s.elements[0], position: { x, y: 0.5 } } as typeof s.elements[0];
    expect(() => exportStrategy(s)).toThrow();
  });
  it('rejects JSON number overflow, duplicate element IDs and storage IDs', () => {
    const s = fixture(); expect(() => importStrategy(exportStrategy(s).replace('"x": 0', '"x": 1e999'))).toThrow();
    s.elements.push(s.elements[0]); expect(() => validateStrategy(s)).toThrow();
    expect(() => loadStrategies({ getItem: () => JSON.stringify([createStrategy(), s]) })).toThrow();
    const clean = fixture(); expect(() => loadStrategies({ getItem: () => JSON.stringify([clean, clean]) })).toThrow();
  });
});
it('read and write failures propagate without mutating editing data', () => {
  const s = fixture(); const original = exportStrategy(s);
  expect(() => saveStrategies({ setItem: () => { throw new DOMException('full', 'QuotaExceededError'); } }, [s])).toThrow();
  expect(() => loadStrategies({ getItem: () => { throw new Error('blocked'); } })).toThrow();
  expect(exportStrategy(s)).toBe(original);
});
it('save never resets undo/redo; switching preserves in-memory histories and reload clears them', () => {
  let state = createWorkspace([fixture()]);
  state = workspaceReducer(state, { type: 'edit', action: { type: 'delete', id: 'h', at: new Date().toISOString() } });
  let saved = ''; saveStrategies({ setItem: (_, v) => { saved = v; } }, state.entries.map(e => e.present));
  state = workspaceReducer(state, { type: 'edit', action: { type: 'undo', at: new Date().toISOString() } });
  expect(state.entries[0].present.elements).toHaveLength(4);
  state = workspaceReducer(state, { type: 'edit', action: { type: 'redo', at: new Date().toISOString() } });
  expect(state.entries[0].present.elements).toHaveLength(3);
  expect(createWorkspace(loadStrategies({ getItem: () => saved })).entries[0].past).toEqual([]);
});

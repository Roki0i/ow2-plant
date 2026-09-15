import { heroes } from '../data/catalog';
import type { Strategy } from './types';

export const STORAGE_KEY = 'ow2-plant.strategies.v1';
export const MAX_STORAGE_SIZE = 20 * 1024 * 1024;
export const MAX_JSON_SIZE = 5 * 1024 * 1024;
function fail(): never { throw new Error('戦術データの形式が不正です（schemaVersion・各項目・座標を確認してください）。'); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  return value as Record<string, unknown>;
}
function keys(o: Record<string, unknown>, names: string[]) {
  if (Object.keys(o).length !== names.length || names.some(k => !Object.hasOwn(o, k))) fail();
}
function str(v: unknown, max = 200): asserts v is string { if (typeof v !== 'string' || !v.length || v.length > max) fail(); }
function point(v: unknown) {
  const p = object(v); keys(p, ['x', 'y']);
  for (const n of [p.x, p.y]) if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1) fail();
}
export function validateStrategy(value: unknown): Strategy {
  const s = object(value);
  keys(s, ['id', 'schemaVersion', 'name', 'mapId', 'areaId', 'mapRevision', 'side', 'elements', 'createdAt', 'updatedAt']);
  str(s.id); str(s.mapRevision);
  if (s.schemaVersion !== 1 || s.mapId !== 'kings-row' || s.areaId !== 'point-a' ||
    (typeof s.side !== 'string' || !['attack', 'defense', 'common'].includes(s.side)) || typeof s.name !== 'string' || s.name.length > 80) fail();
  if (s.mapRevision !== 'abstract-demo-v1' && !/^local-[a-zA-Z0-9-]+$/.test(s.mapRevision)) fail();
  for (const date of [s.createdAt, s.updatedAt]) {
    str(date); if (!Number.isFinite(Date.parse(date)) || new Date(date).toISOString() !== date) fail();
  }
  if (!Array.isArray(s.elements) || s.elements.length > 10000) fail();
  const ids = new Set<string>();
  for (const value of s.elements) {
    const e = object(value); str(e.id);
    if (ids.has(e.id)) fail(); ids.add(e.id);
    if (e.type === 'hero') {
      keys(e, ['id', 'type', 'heroId', 'team', 'position']);
      str(e.heroId);
      if (!heroes.some(h => h.id === e.heroId)) throw new Error(`未対応のHero ID「${e.heroId}」が含まれています。戦術は読み込まず、既存データを保持しました。対応版で開いてください。`);
      if ((typeof e.team !== 'string' || !['ally', 'enemy'].includes(e.team))) fail();
      point(e.position);
    } else {
      if (e.type === 'stroke') {
        keys(e, ['id', 'type', 'points', 'color', 'width']);
        if (!Array.isArray(e.points) || e.points.length < 2 || e.points.length > 2048) fail();
        e.points.forEach(point);
      } else if (e.type === 'line' || e.type === 'arrow') {
        keys(e, ['id', 'type', 'start', 'end', 'color', 'width']); point(e.start); point(e.end);
      } else fail();
      if (typeof e.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(e.color) || typeof e.width !== 'number' || !Number.isFinite(e.width) || e.width < 1 || e.width > 12) fail();
    }
  }
  return value as Strategy;
}
// Sort object keys recursively; array order preserves drawing order.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, canonical(v)]));
  return value;
}
export function exportStrategy(strategy: Strategy): string {
  return JSON.stringify(canonical(validateStrategy(strategy)), null, 2) + '\n';
}
export function importStrategy(json: string): Strategy {
  if (json.length > MAX_JSON_SIZE) throw new Error('JSONは5MB以下にしてください。');
  let value: unknown;
  try { value = JSON.parse(json); } catch { throw new Error('不正なJSONです。'); }
  return validateStrategy(value);
}
export function copyStrategy(strategy: Strategy, existing: Strategy[], duplicate = false): Strategy {
  const copy = JSON.parse(exportStrategy(strategy)) as Strategy;
  if (duplicate || existing.some(s => s.id === copy.id)) {
    do { copy.id = crypto.randomUUID(); } while (existing.some(s => s.id === copy.id));
  }
  if (duplicate) {
    copy.name = `${copy.name.slice(0, 75)} のコピー`;
    copy.createdAt = copy.updatedAt = new Date().toISOString();
  }
  return copy;
}
export function loadStrategies(storage: Pick<Storage, 'getItem'>): Strategy[] {
  const json = storage.getItem(STORAGE_KEY);
  if (json === null) return [];
  if (json.length > MAX_STORAGE_SIZE) fail();
  const values: unknown = JSON.parse(json);
  if (!Array.isArray(values)) fail();
  const result = values.map(validateStrategy);
  if (new Set(result.map(s => s.id)).size !== result.length) fail();
  return result;
}
export function saveStrategies(storage: Pick<Storage, 'setItem'>, strategies: Strategy[]) {
  strategies.forEach(validateStrategy);
  const json = JSON.stringify(canonical(strategies));
  if (json.length > MAX_STORAGE_SIZE) throw new Error('保存容量の上限です。');
  storage.setItem(STORAGE_KEY, json);
}

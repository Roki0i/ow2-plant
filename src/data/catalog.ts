import type { MapDefinition, Strategy } from '../domain/types';

export const initialMap: MapDefinition = {
  id: 'kings-row', name: 'King’s Row', mode: 'hybrid',
  areas: [{ id: 'point-a', name: '第1拠点', width: 1200, height: 800,
    image: { kind: 'original-demo', url: `${import.meta.env.BASE_URL}maps/tactical-demo.svg`, revision: 'abstract-demo-v1' } }],
};

export { heroes } from './heroes';

export function createStrategy(): Strategy {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), schemaVersion: 1, name: '第1拠点のセットアップ',
    mapId: initialMap.id, areaId: initialMap.areas[0].id,
    mapRevision: initialMap.areas[0].image.revision, side: 'attack', elements: [],
    createdAt: now, updatedAt: now };
}

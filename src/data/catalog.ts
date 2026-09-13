import type { HeroDefinition, MapDefinition, Strategy } from '../domain/types';

export const initialMap: MapDefinition = {
  id: 'kings-row', name: 'King’s Row', mode: 'hybrid',
  areas: [{ id: 'point-a', name: '第1拠点', width: 1200, height: 800,
    image: { kind: 'original-demo', url: `${import.meta.env.BASE_URL}maps/tactical-demo.svg`, revision: 'abstract-demo-v1' } }],
};

// Deliberately small Phase 1 catalog; names identify heroes, portraits are not bundled.
export const heroes: HeroDefinition[] = [
  { id: 'reinhardt', name: 'Reinhardt', shortName: 'RE', role: 'tank' },
  { id: 'winston', name: 'Winston', shortName: 'WI', role: 'tank' },
  { id: 'dva', name: 'D.Va', shortName: 'DV', role: 'tank' },
  { id: 'tracer', name: 'Tracer', shortName: 'TR', role: 'damage' },
  { id: 'genji', name: 'Genji', shortName: 'GE', role: 'damage' },
  { id: 'soldier-76', name: 'Soldier: 76', shortName: '76', role: 'damage' },
  { id: 'ana', name: 'Ana', shortName: 'AN', role: 'support' },
  { id: 'lucio', name: 'Lúcio', shortName: 'LU', role: 'support' },
  { id: 'mercy', name: 'Mercy', shortName: 'ME', role: 'support' },
];

export function createStrategy(): Strategy {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), schemaVersion: 1, name: '第1拠点のセットアップ',
    mapId: initialMap.id, areaId: initialMap.areas[0].id,
    mapRevision: initialMap.areas[0].image.revision, side: 'attack', elements: [],
    createdAt: now, updatedAt: now };
}

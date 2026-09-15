import type { HeroDefinition, Role } from '../domain/types';

// Official roster checked 2026-09-15: https://overwatch.blizzard.com/en-us/Heroes/
// IDs are persistent identifiers: never rename an existing ID. No official artwork.
export const heroes: readonly HeroDefinition[] = [
  { id: 'reinhardt', name: 'Reinhardt', role: 'tank', shortLabel: 'RE' },
  { id: 'dmon', name: 'D.Mon', role: 'tank', shortLabel: 'DM' },
  { id: 'dva', name: 'D.Va', role: 'tank', shortLabel: 'DV' },
  { id: 'domina', name: 'Domina', role: 'tank', shortLabel: 'DO' },
  { id: 'doomfist', name: 'Doomfist', role: 'tank', shortLabel: 'DF' },
  { id: 'hazard', name: 'Hazard', role: 'tank', shortLabel: 'HZ' },
  { id: 'junker-queen', name: 'Junker Queen', role: 'tank', shortLabel: 'JQ' },
  { id: 'mauga', name: 'Mauga', role: 'tank', shortLabel: 'MA' },
  { id: 'orisa', name: 'Orisa', role: 'tank', shortLabel: 'OR' },
  { id: 'ramattra', name: 'Ramattra', role: 'tank', shortLabel: 'RA' },
  { id: 'roadhog', name: 'Roadhog', role: 'tank', shortLabel: 'RH' },
  { id: 'sigma', name: 'Sigma', role: 'tank', shortLabel: 'SI' },
  { id: 'winston', name: 'Winston', role: 'tank', shortLabel: 'WI' },
  { id: 'wrecking-ball', name: 'Wrecking Ball', role: 'tank', shortLabel: 'WB' },
  { id: 'zarya', name: 'Zarya', role: 'tank', shortLabel: 'ZA' },
  { id: 'anran', name: 'Anran', role: 'damage', shortLabel: 'AR' },
  { id: 'ashe', name: 'Ashe', role: 'damage', shortLabel: 'AS' },
  { id: 'bastion', name: 'Bastion', role: 'damage', shortLabel: 'BA' },
  { id: 'cassidy', name: 'Cassidy', role: 'damage', shortLabel: 'CA' },
  { id: 'echo', name: 'Echo', role: 'damage', shortLabel: 'EC' },
  { id: 'emre', name: 'Emre', role: 'damage', shortLabel: 'EM' },
  { id: 'freja', name: 'Freja', role: 'damage', shortLabel: 'FR' },
  { id: 'genji', name: 'Genji', role: 'damage', shortLabel: 'GE' },
  { id: 'hanzo', name: 'Hanzo', role: 'damage', shortLabel: 'HA' },
  { id: 'junkrat', name: 'Junkrat', role: 'damage', shortLabel: 'JR' },
  { id: 'mei', name: 'Mei', role: 'damage', shortLabel: 'MI' },
  { id: 'pharah', name: 'Pharah', role: 'damage', shortLabel: 'PH' },
  { id: 'reaper', name: 'Reaper', role: 'damage', shortLabel: 'RP' },
  { id: 'shion', name: 'Shion', role: 'damage', shortLabel: 'SH' },
  { id: 'sierra', name: 'Sierra', role: 'damage', shortLabel: 'SR' },
  { id: 'sojourn', name: 'Sojourn', role: 'damage', shortLabel: 'SJ' },
  { id: 'soldier-76', name: 'Soldier: 76', role: 'damage', shortLabel: '76' },
  { id: 'sombra', name: 'Sombra', role: 'damage', shortLabel: 'SO' },
  { id: 'symmetra', name: 'Symmetra', role: 'damage', shortLabel: 'SY' },
  { id: 'torbjorn', name: 'Torbjörn', role: 'damage', shortLabel: 'TO' },
  { id: 'tracer', name: 'Tracer', role: 'damage', shortLabel: 'TR' },
  { id: 'vendetta', name: 'Vendetta', role: 'damage', shortLabel: 'VD' },
  { id: 'venture', name: 'Venture', role: 'damage', shortLabel: 'VE' },
  { id: 'widowmaker', name: 'Widowmaker', role: 'damage', shortLabel: 'WM' },
  { id: 'ana', name: 'Ana', role: 'support', shortLabel: 'AN' },
  { id: 'baptiste', name: 'Baptiste', role: 'support', shortLabel: 'BP' },
  { id: 'brigitte', name: 'Brigitte', role: 'support', shortLabel: 'BR' },
  { id: 'illari', name: 'Illari', role: 'support', shortLabel: 'IL' },
  { id: 'jetpack-cat', name: 'Jetpack Cat', role: 'support', shortLabel: 'JC' },
  { id: 'juno', name: 'Juno', role: 'support', shortLabel: 'JU' },
  { id: 'kiriko', name: 'Kiriko', role: 'support', shortLabel: 'KI' },
  { id: 'lifeweaver', name: 'Lifeweaver', role: 'support', shortLabel: 'LW' },
  { id: 'lucio', name: 'Lúcio', role: 'support', shortLabel: 'LU' },
  { id: 'mercy', name: 'Mercy', role: 'support', shortLabel: 'ME' },
  { id: 'mizuki', name: 'Mizuki', role: 'support', shortLabel: 'MZ' },
  { id: 'moira', name: 'Moira', role: 'support', shortLabel: 'MO' },
  { id: 'wuyang', name: 'Wuyang', role: 'support', shortLabel: 'WU' },
  { id: 'zenyatta', name: 'Zenyatta', role: 'support', shortLabel: 'ZE' },
] ;

export const roleLabels: Record<Role, string> = { tank: 'Tank / タンク', damage: 'Damage / ダメージ', support: 'Support / サポート' };
export const roles: Role[] = ['tank', 'damage', 'support'];
const normalize = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
export function filterHeroes(query: string, role: Role | 'all' = 'all') {
  const needle = normalize(query);
  return heroes.filter(hero => (role === 'all' || hero.role === role) &&
    [hero.name, hero.id, hero.shortLabel].some(value => normalize(value).includes(needle)));
}

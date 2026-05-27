import { PLAYER_CATEGORIES, COACH_CATEGORIES, MANAGER_CATEGORIES } from '../data';
import { Badge } from '../types';
import { findMatchingBadge, normalize } from './badgeMatching';
import { CatalogOverridesMap, CatalogTab, getEffectiveItem } from './catalogOverrides';

/** Wszystkie unikalne nazwy odznak z katalogu (pole `badge` w data.ts). */
export const getCatalogBadgeNames = (): string[] => {
  const names = new Set<string>();
  for (const cat of [...PLAYER_CATEGORIES, ...COACH_CATEGORIES, ...MANAGER_CATEGORIES]) {
    for (const item of cat.items) {
      if (typeof item === 'object' && item.badge?.trim()) {
        names.add(item.badge.trim());
      }
    }
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'pl'));
};

/** Nazwy z katalogu (z nadpisaniami), które nie mają jeszcze dopasowanego pliku w bazie. */
export const getUnassignedCatalogBadgeNames = (
  allBadges: Badge[],
  overrides: CatalogOverridesMap = {}
): string[] => {
  const names = new Set<string>();
  const tabs: CatalogTab[] = ['zawodnik', 'trener', 'manager'];

  tabs.forEach((tab) => {
    const cats =
      tab === 'zawodnik'
        ? PLAYER_CATEGORIES
        : tab === 'trener'
          ? COACH_CATEGORIES
          : MANAGER_CATEGORIES;
    cats.forEach((cat) => {
      cat.items.forEach((rawItem) => {
        const eff = getEffectiveItem(tab, cat.title, rawItem, overrides);
        if (typeof eff === 'object' && eff.badge?.trim()) {
          names.add(eff.badge.trim());
        }
      });
    });
  });

  return Array.from(names)
    .filter((name) => !findMatchingBadge({ label: name, badge: name }, allBadges))
    .sort((a, b) => a.localeCompare(b, 'pl'));
};

export const isBadgeNameTaken = (name: string, allBadges: Badge[], excludeId?: string): boolean => {
  const n = normalize(name);
  return allBadges.some((b) => b.id !== excludeId && normalize(b.name) === n);
};

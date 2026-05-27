import {
  PLAYER_CATEGORIES,
  COACH_CATEGORIES,
  MANAGER_CATEGORIES,
  Category,
  BadgeItem,
} from '../data';
import { normalize } from './badgeMatching';

const ALL_CATEGORIES: Category[] = [
  ...PLAYER_CATEGORIES,
  ...COACH_CATEGORIES,
  ...MANAGER_CATEGORIES,
];

const FA_SUFFIX = ' FA';

/** Kategorie, w których duplikat nazwy dostaje sufiks „ FA” (np. FB vs FA). */
const FA_DISAMBIGUATION_CATEGORY = 'FOOTBALL ACADEMY';

/**
 * Klucz do wykrywania duplikatów — bez dopisków w nawiasach,
 * np. „…(ze zdjęciem)” i „…zawodnika” to ta sama pozycja.
 */
export const getLabelDuplicateKey = (label: string): string =>
  normalize(label.replace(/\s*\([^)]*\)\s*/g, ' '));

const buildDuplicateLabelKeys = (): Set<string> => {
  const counts = new Map<string, number>();
  for (const cat of ALL_CATEGORIES) {
    for (const item of cat.items) {
      const label = typeof item === 'string' ? item : item.label;
      const key = getLabelDuplicateKey(label);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const dupes = new Set<string>();
  counts.forEach((count, key) => {
    if (count > 1) dupes.add(key);
  });
  return dupes;
};

const DUPLICATE_LABEL_KEYS = buildDuplicateLabelKeys();

export const isDuplicateCatalogLabel = (label: string): boolean =>
  DUPLICATE_LABEL_KEYS.has(getLabelDuplicateKey(label));

export const shouldApplyFaDisplaySuffix = (categoryTitle: string, label: string): boolean => {
  if (!isDuplicateCatalogLabel(label)) return false;
  return categoryTitle.trim().toUpperCase() === FA_DISAMBIGUATION_CATEGORY;
};

const alreadyHasFaSuffix = (label: string): boolean => {
  const t = label.trimEnd();
  return t.endsWith(FA_SUFFIX) || t.endsWith(' FA)');
};

/** Etykieta na liście / w przeglądarce. */
export const getDisplayLabel = (label: string, categoryTitle: string): string => {
  if (!shouldApplyFaDisplaySuffix(categoryTitle, label) || alreadyHasFaSuffix(label)) {
    return label;
  }
  return `${label.trimEnd()}${FA_SUFFIX}`;
};

/**
 * Element katalogu do dopasowania GLB — przy duplikacie w FA nazwa pliku = etykieta z „ FA”
 * (np. „Rejestracja w systemie FA”), nie stary klucz z data.ts.
 */
export const getCatalogMatchingItem = (
  item: BadgeItem,
  categoryTitle: string
): BadgeItem => {
  const baseLabel = typeof item === 'string' ? item : item.label;
  const matchName = getDisplayLabel(baseLabel, categoryTitle);
  if (matchName === baseLabel) return item;
  return { label: matchName, badge: matchName };
};

export const usesExactCatalogMatching = (
  item: BadgeItem,
  categoryTitle: string
): boolean => {
  const baseLabel = typeof item === 'string' ? item : item.label;
  return getDisplayLabel(baseLabel, categoryTitle) !== baseLabel;
};

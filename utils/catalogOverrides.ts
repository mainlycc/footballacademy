import {
  PLAYER_CATEGORIES,
  COACH_CATEGORIES,
  MANAGER_CATEGORIES,
  Category,
  BadgeItem,
} from '../data';
import { loadJsonFromStorage, saveJsonToStorage } from '../db';

export type CatalogTab = 'zawodnik' | 'trener' | 'manager';

export type CatalogOverride = {
  /** Wyświetlana nazwa pozycji na liście. */
  label?: string;
  /** Nazwa pliku / klucz dopasowania do odznaki w bazie. */
  badge?: string;
};

export type CatalogOverridesMap = Record<string, CatalogOverride>;

export const CATALOG_OVERRIDES_PATH = 'config/catalog-overrides.json';
export const CATALOG_OVERRIDES_EVENT = 'fa-catalog-overrides-change';

const dispatchOverridesChange = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CATALOG_OVERRIDES_EVENT));
  }
};

const TAB_CATEGORIES: Record<CatalogTab, Category[]> = {
  zawodnik: PLAYER_CATEGORIES,
  trener: COACH_CATEGORIES,
  manager: MANAGER_CATEGORIES,
};

export const getCatalogItemKey = (
  tab: CatalogTab,
  categoryTitle: string,
  item: BadgeItem
): string => {
  const label = typeof item === 'string' ? item : item.label;
  return `${tab}::${categoryTitle}::${label}`;
};

export const getCategoriesForTab = (tab: CatalogTab): Category[] => TAB_CATEGORIES[tab];

export const applyItemOverride = (item: BadgeItem, override?: CatalogOverride): BadgeItem => {
  if (!override) return item;
  const baseLabel = typeof item === 'string' ? item : item.label;
  const baseBadge = typeof item === 'object' ? item.badge : undefined;
  const newLabel = override.label?.trim() || baseLabel;
  const newBadge = override.badge?.trim() || baseBadge;

  if (override.label === undefined && override.badge === undefined) return item;
  if (!newBadge) {
    if (override.label !== undefined) return newLabel;
    return item;
  }
  return { label: newLabel, badge: newBadge };
};

export const applyOverridesToCategories = (
  categories: Category[],
  tab: CatalogTab,
  overrides: CatalogOverridesMap
): Category[] =>
  categories.map((cat) => ({
    ...cat,
    items: cat.items.map((item) =>
      applyItemOverride(item, overrides[getCatalogItemKey(tab, cat.title, item)])
    ),
  }));

export const getEffectiveItem = (
  tab: CatalogTab,
  categoryTitle: string,
  item: BadgeItem,
  overrides: CatalogOverridesMap
): BadgeItem => applyItemOverride(item, overrides[getCatalogItemKey(tab, categoryTitle, item)]);

export const loadCatalogOverrides = async (): Promise<CatalogOverridesMap> => {
  const data = await loadJsonFromStorage<CatalogOverridesMap>(CATALOG_OVERRIDES_PATH);
  return data && typeof data === 'object' ? data : {};
};

export const saveCatalogOverrides = async (overrides: CatalogOverridesMap): Promise<void> => {
  await saveJsonToStorage(CATALOG_OVERRIDES_PATH, overrides);
  dispatchOverridesChange();
};

export const setCatalogOverride = (
  overrides: CatalogOverridesMap,
  key: string,
  patch: CatalogOverride | null
): CatalogOverridesMap => {
  const next = { ...overrides };
  if (!patch || (patch.label === undefined && patch.badge === undefined)) {
    delete next[key];
    return next;
  }
  const prev = next[key] || {};
  const merged: CatalogOverride = { ...prev, ...patch };
  if (!merged.label?.trim()) delete merged.label;
  if (!merged.badge?.trim()) delete merged.badge;
  if (!merged.label && !merged.badge) {
    delete next[key];
  } else {
    next[key] = merged;
  }
  return next;
};

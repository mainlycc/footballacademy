import { CatalogTab } from './catalogOverrides';

const STORAGE_KEY = 'fa_viewer_position';

const VALID_TABS: CatalogTab[] = ['zawodnik', 'trener', 'manager'];

export type ViewerSavedPosition = {
  activeTab: CatalogTab;
  itemKeyByTab: Partial<Record<CatalogTab, string>>;
};

const defaultPosition = (): ViewerSavedPosition => ({
  activeTab: 'zawodnik',
  itemKeyByTab: {},
});

export const loadViewerPosition = (): ViewerSavedPosition => {
  if (typeof window === 'undefined') return defaultPosition();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPosition();
    const parsed = JSON.parse(raw) as ViewerSavedPosition;
    if (!VALID_TABS.includes(parsed.activeTab)) return defaultPosition();
    return {
      activeTab: parsed.activeTab,
      itemKeyByTab: parsed.itemKeyByTab ?? {},
    };
  } catch {
    return defaultPosition();
  }
};

export const saveViewerPosition = (pos: ViewerSavedPosition): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    /* quota / private mode */
  }
};

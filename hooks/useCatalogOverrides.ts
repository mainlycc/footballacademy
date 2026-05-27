import { useCallback, useEffect, useState } from 'react';
import {
  CatalogOverride,
  CatalogOverridesMap,
  CATALOG_OVERRIDES_EVENT,
  loadCatalogOverrides,
  saveCatalogOverrides,
  setCatalogOverride,
} from '../utils/catalogOverrides';

export const useCatalogOverrides = () => {
  const [overrides, setOverrides] = useState<CatalogOverridesMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setOverrides(await loadCatalogOverrides());
    } catch (e) {
      console.error('loadCatalogOverrides:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const handler = () => void reload();
    window.addEventListener(CATALOG_OVERRIDES_EVENT, handler);
    return () => window.removeEventListener(CATALOG_OVERRIDES_EVENT, handler);
  }, [reload]);

  const persist = useCallback(async (next: CatalogOverridesMap) => {
    setSaving(true);
    try {
      await saveCatalogOverrides(next);
      setOverrides(next);
    } finally {
      setSaving(false);
    }
  }, []);

  const updateOverride = useCallback(
    async (key: string, patch: CatalogOverride | null) => {
      const next = setCatalogOverride(overrides, key, patch);
      await persist(next);
    },
    [overrides, persist]
  );

  return { overrides, loading, saving, reload, updateOverride };
};

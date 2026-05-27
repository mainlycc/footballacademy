import { useCallback, useEffect, useState } from 'react';

export type BadgeVec3 = readonly [number, number, number];

/** Ustawienia światła odznaki — zapis w `localStorage` (cała aplikacja). */
export interface BadgeLightingConfig {
  ambientDark: number;
  ambientLit: number;
  dirIntensityDark: number;
  dirIntensityLit: number;
  dirPosDark: BadgeVec3;
  dirPosLit: BadgeVec3;
  envDark: number;
  envLit: number;
  contactOpacityDark: number;
  contactOpacityLit: number;
  /** Drugie światło (z innej strony) — odsłania wgłębienia bez „światła prosto w twarz”. */
  fillIntensityDark: number;
  fillIntensityLit: number;
  fillPosDark: BadgeVec3;
  fillPosLit: BadgeVec3;
}

export const DEFAULT_BADGE_LIGHTING: BadgeLightingConfig = {
  ambientDark: 0.1,
  ambientLit: 0.6,
  dirIntensityDark: 0.2,
  dirIntensityLit: 1.0,
  dirPosDark: [2, 5, 2],
  dirPosLit: [7, 3, 4],
  envDark: 0,
  envLit: 0.6,
  contactOpacityDark: 0,
  contactOpacityLit: 0.4,
  fillIntensityDark: 0.22,
  fillIntensityLit: 0.32,
  fillPosDark: [-5, 4, -3],
  fillPosLit: [-4, 5, -2],
};

const STORAGE_KEY = 'fa_badge_lighting_v1';

export const BADGE_LIGHTING_CHANGE_EVENT = 'fa-badge-lighting-change';

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function sanitizeVec3(v: unknown, fallback: BadgeVec3): BadgeVec3 {
  if (!Array.isArray(v) || v.length !== 3) return fallback;
  const a = Number(v[0]);
  const b = Number(v[1]);
  const c = Number(v[2]);
  if (![a, b, c].every((x) => Number.isFinite(x))) return fallback;
  return [a, b, c];
}

function sanitizeNumber(n: unknown, fallback: number, lo: number, hi: number): number {
  const x = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  return clamp(x, lo, hi);
}

export function normalizeBadgeLightingConfig(raw: Partial<BadgeLightingConfig> | null | undefined): BadgeLightingConfig {
  const d = DEFAULT_BADGE_LIGHTING;
  if (!raw || typeof raw !== 'object') return { ...d };
  return {
    ambientDark: sanitizeNumber(raw.ambientDark, d.ambientDark, 0, 2),
    ambientLit: sanitizeNumber(raw.ambientLit, d.ambientLit, 0, 2),
    dirIntensityDark: sanitizeNumber(raw.dirIntensityDark, d.dirIntensityDark, 0, 3),
    dirIntensityLit: sanitizeNumber(raw.dirIntensityLit, d.dirIntensityLit, 0, 3),
    dirPosDark: sanitizeVec3(raw.dirPosDark, d.dirPosDark),
    dirPosLit: sanitizeVec3(raw.dirPosLit, d.dirPosLit),
    envDark: sanitizeNumber(raw.envDark, d.envDark, 0, 2),
    envLit: sanitizeNumber(raw.envLit, d.envLit, 0, 2),
    contactOpacityDark: sanitizeNumber(raw.contactOpacityDark, d.contactOpacityDark, 0, 1),
    contactOpacityLit: sanitizeNumber(raw.contactOpacityLit, d.contactOpacityLit, 0, 1),
    fillIntensityDark: sanitizeNumber(raw.fillIntensityDark, d.fillIntensityDark, 0, 2),
    fillIntensityLit: sanitizeNumber(raw.fillIntensityLit, d.fillIntensityLit, 0, 2),
    fillPosDark: sanitizeVec3(raw.fillPosDark, d.fillPosDark),
    fillPosLit: sanitizeVec3(raw.fillPosLit, d.fillPosLit),
  };
}

export function loadBadgeLightingConfig(): BadgeLightingConfig {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return { ...DEFAULT_BADGE_LIGHTING };
    const parsed = JSON.parse(s) as Partial<BadgeLightingConfig>;
    return normalizeBadgeLightingConfig(parsed);
  } catch {
    return { ...DEFAULT_BADGE_LIGHTING };
  }
}

export function saveBadgeLightingConfig(config: BadgeLightingConfig): void {
  try {
    const normalized = normalizeBadgeLightingConfig(config);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent(BADGE_LIGHTING_CHANGE_EVENT));
  } catch {
    // ignore quota / private mode
  }
}

export function patchBadgeLightingConfig(patch: Partial<BadgeLightingConfig>): BadgeLightingConfig {
  const base = loadBadgeLightingConfig();
  const merged: BadgeLightingConfig = {
    ...base,
    ...patch,
    dirPosDark: patch.dirPosDark !== undefined ? sanitizeVec3(patch.dirPosDark, base.dirPosDark) : base.dirPosDark,
    dirPosLit: patch.dirPosLit !== undefined ? sanitizeVec3(patch.dirPosLit, base.dirPosLit) : base.dirPosLit,
    fillPosDark: patch.fillPosDark !== undefined ? sanitizeVec3(patch.fillPosDark, base.fillPosDark) : base.fillPosDark,
    fillPosLit: patch.fillPosLit !== undefined ? sanitizeVec3(patch.fillPosLit, base.fillPosLit) : base.fillPosLit,
  };
  const normalized = normalizeBadgeLightingConfig(merged);
  saveBadgeLightingConfig(normalized);
  return normalized;
}

export function resetBadgeLightingConfig(): BadgeLightingConfig {
  saveBadgeLightingConfig({ ...DEFAULT_BADGE_LIGHTING });
  return { ...DEFAULT_BADGE_LIGHTING };
}

export function useBadgeLightingConfig(): {
  config: BadgeLightingConfig;
  update: (patch: Partial<BadgeLightingConfig>) => void;
  reset: () => void;
} {
  const [config, setConfig] = useState<BadgeLightingConfig>(() => loadBadgeLightingConfig());

  useEffect(() => {
    const onChange = () => setConfig(loadBadgeLightingConfig());
    window.addEventListener(BADGE_LIGHTING_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(BADGE_LIGHTING_CHANGE_EVENT, onChange);
  }, []);

  const update = useCallback((patch: Partial<BadgeLightingConfig>) => {
    setConfig(patchBadgeLightingConfig(patch));
  }, []);

  const reset = useCallback(() => {
    setConfig(resetBadgeLightingConfig());
  }, []);

  return { config, update, reset };
}

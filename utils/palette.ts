/**
 * Globalna paleta systemowych ("ulubionych") kolorów odznak.
 *
 * Trzymana jest jako pojedynczy plik JSON `palette.json` w bucket `badges`.
 * Format:
 *   { "colors": [{ "hex": "#1A2B3C", "name": "FA Blue" }, ...] }
 *
 * Gdy plik nie istnieje, zwracana jest pusta paleta.
 */

import { loadJsonFromStorage, saveJsonToStorage } from '../db';

export interface PaletteColor {
  hex: string;
  name?: string;
}

export interface Palette {
  colors: PaletteColor[];
}

const PALETTE_PATH = 'palette.json';
const EMPTY_PALETTE: Palette = { colors: [] };

const normalizeHex = (hex: string): string => {
  if (!hex) return '#000000';
  let h = hex.trim();
  if (!h.startsWith('#')) h = '#' + h;
  // Rozszerz #abc → #aabbcc
  if (/^#([0-9a-f]{3})$/i.test(h)) {
    h = '#' + h.slice(1).split('').map((c) => c + c).join('');
  }
  return h.toUpperCase();
};

export const loadPalette = async (): Promise<Palette> => {
  const data = await loadJsonFromStorage<Palette>(PALETTE_PATH);
  if (!data || !Array.isArray(data.colors)) return EMPTY_PALETTE;
  return {
    colors: data.colors
      .filter((c) => c && typeof c.hex === 'string')
      .map((c) => ({ hex: normalizeHex(c.hex), name: c.name }))
  };
};

export const savePalette = async (palette: Palette): Promise<void> => {
  const sanitized: Palette = {
    colors: palette.colors
      .filter((c) => c && typeof c.hex === 'string')
      .map((c) => ({ hex: normalizeHex(c.hex), name: c.name?.trim() || undefined }))
  };
  await saveJsonToStorage(PALETTE_PATH, sanitized);
};

export const addColor = async (hex: string, name?: string): Promise<Palette> => {
  const palette = await loadPalette();
  const normalized = normalizeHex(hex);
  if (palette.colors.some((c) => c.hex === normalized)) {
    return palette;
  }
  const next: Palette = {
    colors: [...palette.colors, { hex: normalized, name: name?.trim() || undefined }]
  };
  await savePalette(next);
  return next;
};

export const removeColor = async (hex: string): Promise<Palette> => {
  const palette = await loadPalette();
  const normalized = normalizeHex(hex);
  const next: Palette = {
    colors: palette.colors.filter((c) => c.hex !== normalized)
  };
  await savePalette(next);
  return next;
};

export const renameColor = async (hex: string, name: string): Promise<Palette> => {
  const palette = await loadPalette();
  const normalized = normalizeHex(hex);
  const next: Palette = {
    colors: palette.colors.map((c) =>
      c.hex === normalized ? { ...c, name: name.trim() || undefined } : c
    )
  };
  await savePalette(next);
  return next;
};

export { normalizeHex };

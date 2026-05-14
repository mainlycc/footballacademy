/**
 * Systemowe presety materiałów (metal/szkło) — zapisane w Storage jako JSON.
 *
 * Format:
 * {
 *   "presets": [
 *     { "id": "glass", "name": "Szkło", "props": { "transmission": 1, "roughness": 0.05, "ior": 1.5, "opacity": 1, "transparent": true } },
 *     ...
 *   ]
 * }
 */

import { loadJsonFromStorage, saveJsonToStorage } from '../db';

export type MaterialPresetProps = {
  metalness?: number;
  roughness?: number;
  opacity?: number;
  transparent?: boolean;
  transmission?: number;
  ior?: number;
  thickness?: number;
};

export type MaterialPreset = {
  id: string;
  name: string;
  props: MaterialPresetProps;
};

export type MaterialPresetsFile = {
  presets: MaterialPreset[];
};

const PRESETS_PATH = 'material-presets.json';
const EMPTY: MaterialPresetsFile = { presets: [] };

const safeId = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || `preset-${Date.now()}`;

export const loadMaterialPresets = async (): Promise<MaterialPresetsFile> => {
  const data = await loadJsonFromStorage<MaterialPresetsFile>(PRESETS_PATH);
  if (!data || !Array.isArray(data.presets)) return EMPTY;
  return {
    presets: data.presets.filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string')
  };
};

export const saveMaterialPresets = async (file: MaterialPresetsFile): Promise<void> => {
  const sanitized: MaterialPresetsFile = {
    presets: (file.presets || []).map((p) => ({
      id: String(p.id),
      name: String(p.name),
      props: p.props || {}
    }))
  };
  await saveJsonToStorage(PRESETS_PATH, sanitized);
};

export const addMaterialPreset = async (name: string, props: MaterialPresetProps): Promise<MaterialPresetsFile> => {
  const file = await loadMaterialPresets();
  const id = safeId(name);
  const next: MaterialPresetsFile = {
    presets: [...file.presets, { id, name: name.trim() || id, props }]
  };
  await saveMaterialPresets(next);
  return next;
};

export const removeMaterialPreset = async (id: string): Promise<MaterialPresetsFile> => {
  const file = await loadMaterialPresets();
  const next: MaterialPresetsFile = { presets: file.presets.filter((p) => p.id !== id) };
  await saveMaterialPresets(next);
  return next;
};


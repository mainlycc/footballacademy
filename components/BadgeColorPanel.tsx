import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { Palette as PaletteIcon, Save, RotateCcw, Plus, Trash2, Loader2, AlertCircle, Image as ImageIcon, Check, ChevronDown, Star, SlidersHorizontal, GlassWater, Shield, FlipVertical2, Link2, Unlink2, ArrowDownUp, ArrowLeftRight, MousePointer2, Hand, Upload } from 'lucide-react';
import { Badge } from '../types';
import {
  extractMaterials,
  applyColorChange,
  applyTextureChange,
  exportGLBFromScene,
  createBadgeMapTextureFromFile,
  applyMapTextureToMaterial,
  configureBadgeTexture,
  MaterialEntry,
  TextureTransformState,
  DEFAULT_TEXTURE_TRANSFORM,
  textureStatesEqual,
  applyImageAspectTextureFix,
  getPrimaryTexture,
  repairBadgeMapTexture,
} from '../utils/glbColorEditor';
import { loadPalette, addColor, removeColor, normalizeHex, Palette } from '../utils/palette';
import { replaceBadgeFile } from '../db';
import { addMaterialPreset, loadMaterialPresets, removeMaterialPreset, MaterialPreset, MaterialPresetProps } from '../utils/materialPresets';
interface BadgeColorPanelProps {
  badge: Badge | null;
  scene: THREE.Object3D | null;
  /** Wywoływane po pomyślnym zapisie GLB w Supabase. */
  onSaved?: () => void | Promise<void>;
  /**
   * Integracja z podglądem: panel wystawia API do przeciągania tekstury myszką
   * (Viewer deleguje pointer events z `Badge3D`).
   */
  onTextureDragApi?: (api: {
    isEnabled: () => boolean;
    onPointerDown: (e: any) => void;
    onPointerMove: (e: any) => void;
    onPointerUp: (e: any) => void;
    onPointerLeave: (e: any) => void;
  }) => void;
}

const BadgeColorPanel: React.FC<BadgeColorPanelProps> = ({
  badge,
  scene,
  onSaved,
  onTextureDragApi,
}) => {
  const [materials, setMaterials] = useState<MaterialEntry[]>([]);
  const [originalByName, setOriginalByName] = useState<Record<string, string>>({});
  const [originalByUuid, setOriginalByUuid] = useState<Record<string, string>>({});
  const [hexDraftByGroupId, setHexDraftByGroupId] = useState<Record<string, string>>({});
  const [palette, setPalette] = useState<Palette>({ colors: [] });
  const [paletteLoading, setPaletteLoading] = useState(false);
  const [materialPresets, setMaterialPresets] = useState<MaterialPreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [openPaletteFor, setOpenPaletteFor] = useState<string | null>(null);
  const [openAdvancedFor, setOpenAdvancedFor] = useState<string | null>(null);
  const [openTextureFor, setOpenTextureFor] = useState<string | null>(null);
  const [textureLinkRepeat, setTextureLinkRepeat] = useState<Record<string, boolean>>({});
  const [originalTextureByUuid, setOriginalTextureByUuid] = useState<Record<string, TextureTransformState>>({});
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#1E40AF');
  const [newPresetName, setNewPresetName] = useState('');
  const [selectedPresetByGroupId, setSelectedPresetByGroupId] = useState<Record<string, string>>({});
  const [dragGroupId, setDragGroupId] = useState<string | null>(null);
  const dragEntriesRef = useRef<MaterialEntry[] | null>(null);
  const dragActiveRef = useRef(false);
  const [pngUploading, setPngUploading] = useState(false);
  const [replacedMapByUuid, setReplacedMapByUuid] = useState<Record<string, boolean>>({});
  const [mapPreviewByGroupId, setMapPreviewByGroupId] = useState<Record<string, string>>({});
  const pngFileInputRef = useRef<HTMLInputElement>(null);
  const pngUploadEntriesRef = useRef<MaterialEntry[] | null>(null);
  const pngUploadGroupIdRef = useRef<string | null>(null);
  const originalMapByUuidRef = useRef<Record<string, THREE.Texture>>({});

  // 1) Wyciągnij materiały gdy zmieni się scena lub odznaka.
  useEffect(() => {
    if (!scene) {
      setMaterials([]);
      setOriginalByName({});
      setOriginalByUuid({});
      setOriginalTextureByUuid({});
      setGroupChanges({});
      setReplacedMapByUuid({});
      setMapPreviewByGroupId({});
      originalMapByUuidRef.current = {};
      return;
    }
    const list = extractMaterials(scene);
    setMaterials(list);
    const orig: Record<string, string> = {};
    const origUuid: Record<string, string> = {};
    const origTex: Record<string, TextureTransformState> = {};
    list.forEach((m) => {
      if (m.name) orig[m.name] = m.hex;
      origUuid[m.uuid] = m.hex;
      if (m.texture) origTex[m.uuid] = { ...m.texture };
    });
    setOriginalByName(orig);
    setOriginalByUuid(origUuid);
    setOriginalTextureByUuid(origTex);
    setGroupChanges({});
    setReplacedMapByUuid({});
    setMapPreviewByGroupId({});
    originalMapByUuidRef.current = {};
    setHexDraftByGroupId({});
    setSaveError('');
    setSaveSuccess(false);
  }, [scene, badge?.id]);

  // 2) Ładuj paletę przy mount (i po zapisach).
  const reloadPalette = useCallback(async () => {
    setPaletteLoading(true);
    try {
      const p = await loadPalette();
      setPalette(p);
    } catch (err) {
      console.warn('Nie udało się załadować palety:', err);
    } finally {
      setPaletteLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadPalette();
  }, [reloadPalette]);

  const reloadPresets = useCallback(async () => {
    setPresetsLoading(true);
    try {
      const file = await loadMaterialPresets();
      setMaterialPresets(file.presets);
    } catch (err) {
      console.warn('Nie udało się załadować presetów materiału:', err);
    } finally {
      setPresetsLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadPresets();
  }, [reloadPresets]);

  const getGroupCurrentProps = (entries: MaterialEntry[]): GroupMaterialProps => {
    const pick = <K extends keyof GroupMaterialProps>(key: K): GroupMaterialProps[K] => {
      const found = entries.find((e) => (e as any)[key] !== undefined);
      return found ? ((found as any)[key] as any) : undefined;
    };
    return {
      metalness: pick('metalness'),
      roughness: pick('roughness'),
      opacity: pick('opacity'),
      transparent: pick('transparent'),
      transmission: pick('transmission'),
      ior: pick('ior'),
      thickness: pick('thickness')
    };
  };

  const getGroupOriginalHex = (entries: MaterialEntry[]): string => {
    const e0 = entries[0];
    return (e0 ? (originalByUuid[e0.uuid] || originalByName[e0.name] || e0.hex) : '#FFFFFF').toUpperCase();
  };

  const getGroupOriginalTexture = (entries: MaterialEntry[]): TextureTransformState => {
    const e0 = entries.find((e) => e.hasTexture) || entries[0];
    if (!e0) return { ...DEFAULT_TEXTURE_TRANSFORM };
    return originalTextureByUuid[e0.uuid] || e0.texture || { ...DEFAULT_TEXTURE_TRANSFORM };
  };

  const getGroupCurrentTexture = (entries: MaterialEntry[]): TextureTransformState => {
    const groupOrig = getGroupOriginalHex(entries);
    const fromChange = groupChanges[groupOrig]?.texture;
    if (fromChange) return fromChange;
    const e0 = entries.find((e) => e.texture) || entries[0];
    return e0?.texture || getGroupOriginalTexture(entries);
  };

  const isGroupTextureDirty = (entries: MaterialEntry[]): boolean => {
    const current = getGroupCurrentTexture(entries);
    const original = getGroupOriginalTexture(entries);
    return !textureStatesEqual(current, original);
  };

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const clampRepeat = (v: number) => Math.max(0.05, Math.min(8, v));
  const clampOffset = (v: number) => Math.max(-2, Math.min(2, v));
  const TEXTURE_STRETCH_STEP = 1.18;

  const nudgeTextureStretch = (
    entries: MaterialEntry[],
    axis: 'vertical' | 'horizontal',
    mode: 'lessStretch' | 'moreStretch'
  ) => {
    const t = getGroupCurrentTexture(entries);
    const factor = mode === 'lessStretch' ? TEXTURE_STRETCH_STEP : 1 / TEXTURE_STRETCH_STEP;
    if (axis === 'vertical') {
      handleGroupTextureChange(entries, { repeatY: clampRepeat(t.repeatY * factor) });
    } else {
      handleGroupTextureChange(entries, { repeatX: clampRepeat(t.repeatX * factor) });
    }
  };

  const applyPresetToGroup = (entries: MaterialEntry[], preset: MaterialPreset) => {
    handleGroupPropsChange(entries, preset.props);
  };

  const handleSavePresetFromGroup = async (name: string, props: MaterialPresetProps) => {
    if (!name.trim()) return;
    setPresetsLoading(true);
    try {
      const file = await addMaterialPreset(name, props);
      setMaterialPresets(file.presets);
      setNewPresetName('');
    } catch (err) {
      console.error(err);
      alert('Błąd zapisu presetu');
    } finally {
      setPresetsLoading(false);
    }
  };

  const handleRemovePreset = async (id: string) => {
    if (!confirm('Usunąć preset systemowy?')) return;
    setPresetsLoading(true);
    try {
      const file = await removeMaterialPreset(id);
      setMaterialPresets(file.presets);
    } catch (err) {
      console.error(err);
      alert('Błąd usuwania presetu');
    } finally {
      setPresetsLoading(false);
    }
  };

  type GroupMaterialProps = {
    metalness?: number;
    roughness?: number;
    opacity?: number;
    transparent?: boolean;
    transmission?: number;
    ior?: number;
    thickness?: number;
  };

  type GroupChange = {
    color?: string;
    props?: GroupMaterialProps;
    texture?: TextureTransformState;
  };

  const [groupChanges, setGroupChanges] = useState<Record<string, GroupChange>>({});

  // 3) Edycja koloru — działa na grupę materiałów o tym samym hex.
  const handleGroupColorChange = (entries: MaterialEntry[], hex: string) => {
    const normalized = normalizeHex(hex);
    entries.forEach((entry) => {
      applyColorChange(scene, entry.uuid, normalized);
    });
    setGroupChanges((prev) => {
      const next = { ...prev };
      entries.forEach((entry) => {
        const orig = (originalByUuid[entry.uuid] || originalByName[entry.name] || entry.hex).toUpperCase();
        next[orig] = { ...(next[orig] || {}), color: normalized };
      });
      return next;
    });
    setMaterials((prev) => {
      const uuids = new Set(entries.map((e) => e.uuid));
      return prev.map((m) => (uuids.has(m.uuid) ? { ...m, hex: normalized } : m));
    });
  };

  const applyGroupPropsLive = (entries: MaterialEntry[], props: GroupMaterialProps) => {
    if (!scene) return;
    scene.traverse((child: any) => {
      if (!(child instanceof THREE.Mesh) || !child.material) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat: any) => {
        const hit = entries.some((e) => e.uuid === mat.uuid);
        if (!hit) return;
        if (typeof props.metalness === 'number' && typeof mat.metalness === 'number') mat.metalness = props.metalness;
        if (typeof props.roughness === 'number' && typeof mat.roughness === 'number') mat.roughness = props.roughness;
        if (typeof props.opacity === 'number' && typeof mat.opacity === 'number') mat.opacity = props.opacity;
        if (typeof props.transparent === 'boolean' && typeof mat.transparent === 'boolean') mat.transparent = props.transparent;
        if (typeof props.transmission === 'number' && typeof mat.transmission === 'number') mat.transmission = props.transmission;
        if (typeof props.ior === 'number' && typeof mat.ior === 'number') mat.ior = props.ior;
        if (typeof props.thickness === 'number' && typeof mat.thickness === 'number') mat.thickness = props.thickness;
        mat.needsUpdate = true;
      });
    });
  };

  const handleGroupTextureChange = (entries: MaterialEntry[], patch: Partial<TextureTransformState>) => {
    const groupOrig = getGroupOriginalHex(entries);
    const base = getGroupCurrentTexture(entries);
    const merged: TextureTransformState = { ...base, ...patch };

    entries.forEach((entry) => {
      if (!entry.hasTexture) return;
      applyTextureChange(scene, entry.uuid, patch);
    });

    setGroupChanges((prev) => ({
      ...prev,
      [groupOrig]: { ...(prev[groupOrig] || {}), texture: merged }
    }));

    setMaterials((prev) => {
      const uuids = new Set(entries.map((e) => e.uuid));
      return prev.map((m) => (uuids.has(m.uuid) && m.hasTexture ? { ...m, texture: merged } : m));
    });
  };

  const isDragEnabled = useCallback(() => {
    if (!scene) return false;
    if (!dragGroupId) return false;
    const entries = dragEntriesRef.current;
    return Boolean(entries && entries.length > 0 && entries.some((e) => e.hasTexture));
  }, [scene, dragGroupId]);

  const handleDragPointerDown = (e: any) => {
    if (!scene || !dragGroupId) return;
    const entries = dragEntriesRef.current;
    if (!entries || entries.length === 0) return;
    dragActiveRef.current = true;

    const el = (e?.nativeEvent?.target ?? null) as HTMLElement | null;
    try {
      el?.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handleDragPointerMove = (e: any) => {
    if (!scene) return;
    if (!dragActiveRef.current) return;
    const entries = dragEntriesRef.current;
    if (!entries || entries.length === 0) return;

    const moveX = Number(e?.nativeEvent?.movementX ?? 0);
    const moveY = Number(e?.nativeEvent?.movementY ?? 0);
    if (moveX === 0 && moveY === 0) return;

    const t = getGroupCurrentTexture(entries);
    const repeat = Math.max(t.repeatX, t.repeatY, 0.05);
    const step = 1 / (900 * repeat);
    handleGroupTextureChange(entries, {
      offsetX: clampOffset(t.offsetX - moveX * step),
      offsetY: clampOffset(t.offsetY + moveY * step),
    });
  };

  const endDrag = useCallback((e?: any) => {
    dragActiveRef.current = false;
    const el = (e?.nativeEvent?.target ?? null) as HTMLElement | null;
    try {
      el?.releasePointerCapture?.(e?.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  // Wystaw API do Viewer (delegacja pointer events z podglądu).
  useEffect(() => {
    if (!onTextureDragApi) return;
    onTextureDragApi({
      isEnabled: () => isDragEnabled(),
      onPointerDown: handleDragPointerDown,
      onPointerMove: handleDragPointerMove,
      onPointerUp: (e) => endDrag(e),
      onPointerLeave: (e) => endDrag(e),
    });
  }, [onTextureDragApi, isDragEnabled, dragGroupId, scene, groupChanges, materials, endDrag]);

  const handleResetGroupTexture = (entries: MaterialEntry[], groupId?: string) => {
    const hadReplacement = entries.some((e) => replacedMapByUuid[e.uuid]);
    if (hadReplacement && scene) {
      entries.forEach((entry) => {
        restoreOriginalMap(entry.uuid);
      });
      setReplacedMapByUuid((prev) => {
        const next = { ...prev };
        entries.forEach((e) => delete next[e.uuid]);
        return next;
      });
      if (groupId) {
        setMapPreviewByGroupId((prev) => {
          const old = prev[groupId];
          if (old?.startsWith('blob:')) URL.revokeObjectURL(old);
          const next = { ...prev };
          delete next[groupId];
          return next;
        });
      }
      setMaterials(extractMaterials(scene));
    }

    const original = getGroupOriginalTexture(entries);
    handleGroupTextureChange(entries, original);
    const groupOrig = getGroupOriginalHex(entries);
    setGroupChanges((prev) => {
      const next = { ...prev };
      const ch = next[groupOrig];
      if (!ch) return next;
      const { texture: _t, ...rest } = ch;
      if (Object.keys(rest).length === 0) delete next[groupOrig];
      else next[groupOrig] = rest;
      return next;
    });
  };

  const backupOriginalMap = (materialUuid: string) => {
    if (!scene || originalMapByUuidRef.current[materialUuid]) return;
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || !child.material) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat) => {
        if (mat.uuid !== materialUuid) return;
        const m = mat as THREE.MeshStandardMaterial;
        if (!m.map) return;
        originalMapByUuidRef.current[materialUuid] = m.map.clone();
      });
    });
  };

  const restoreOriginalMap = (materialUuid: string) => {
    if (!scene) return;
    const backup = originalMapByUuidRef.current[materialUuid];
    if (!backup) return;
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || !child.material) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat) => {
        if (mat.uuid !== materialUuid) return;
        const m = mat as THREE.MeshStandardMaterial;
        if (m.map && m.map !== backup) m.map.dispose();
        m.map = backup.clone();
        configureBadgeTexture(m.map, 'map');
        m.needsUpdate = true;
      });
    });
  };

  const triggerPngUpload = (entries: MaterialEntry[], groupId: string) => {
    pngUploadEntriesRef.current = entries;
    pngUploadGroupIdRef.current = groupId;
    pngFileInputRef.current?.click();
  };

  const handlePngFileSelected = async (file: File | undefined) => {
    const entries = pngUploadEntriesRef.current;
    pngUploadEntriesRef.current = null;
    if (!file || !entries?.length || !scene) return;

    const type = file.type.toLowerCase();
    if (type !== 'image/png' && type !== 'image/webp') {
      alert('Dozwolone formaty: PNG lub WebP.');
      return;
    }

    setPngUploading(true);
    setSaveError('');
    try {
      const tex = await createBadgeMapTextureFromFile(file);
      entries.forEach((entry, idx) => {
        backupOriginalMap(entry.uuid);
        applyMapTextureToMaterial(scene, entry.uuid, tex, {
          disposePreviousMap: idx === 0,
        });
      });

      const previewUrl = URL.createObjectURL(file);
      const groupId = pngUploadGroupIdRef.current;
      if (groupId) {
        setMapPreviewByGroupId((prev) => {
          const old = prev[groupId];
          if (old?.startsWith('blob:')) URL.revokeObjectURL(old);
          return { ...prev, [groupId]: previewUrl };
        });
      }
      pngUploadGroupIdRef.current = null;

      setReplacedMapByUuid((prev) => {
        const next = { ...prev };
        entries.forEach((e) => {
          next[e.uuid] = true;
        });
        return next;
      });

      const list = extractMaterials(scene);
      setMaterials(list);
      list.forEach((m) => {
        if (m.texture) {
          setOriginalTextureByUuid((prev) => ({
            ...prev,
            [m.uuid]: entries.some((e) => e.uuid === m.uuid)
              ? { ...DEFAULT_TEXTURE_TRANSFORM }
              : prev[m.uuid] ?? { ...DEFAULT_TEXTURE_TRANSFORM },
          }));
        }
      });

      const groupOrig = getGroupOriginalHex(entries);
      setGroupChanges((prev) => ({
        ...prev,
        [groupOrig]: {
          ...(prev[groupOrig] || {}),
          texture: { ...DEFAULT_TEXTURE_TRANSFORM },
        },
      }));
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Nie udało się wczytać PNG.');
    } finally {
      setPngUploading(false);
      if (pngFileInputRef.current) pngFileInputRef.current.value = '';
    }
  };

  const handleRepairTextureFringe = (entries: MaterialEntry[]) => {
    if (!scene) return;
    let repaired = 0;
    entries.forEach((entry) => {
      if (!entry.hasTexture) return;
      scene.traverse((child) => {
        if (!(child instanceof THREE.Mesh) || !child.material) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat) => {
          if (mat.uuid !== entry.uuid) return;
          if (repairBadgeMapTexture(mat)) repaired++;
        });
      });
    });
    if (repaired === 0) {
      alert('Nie udało się przetworzyć mapy — obraz może nie być jeszcze załadowany.');
    }
  };

  const handleApplyImageAspectFix = (entries: MaterialEntry[]) => {
    if (!scene) return;
    let repeatX = 1;
    let repeatY = 1;
    let applied = false;
    entries.forEach((entry) => {
      if (!entry.hasTexture) return;
      scene.traverse((child) => {
        if (!(child instanceof THREE.Mesh) || !child.material) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat) => {
          if (mat.uuid !== entry.uuid) return;
          if (!applyImageAspectTextureFix(mat)) return;
          const tex = getPrimaryTexture(mat);
          if (!tex) return;
          repeatX = tex.repeat.x;
          repeatY = tex.repeat.y;
          applied = true;
        });
      });
    });
    if (applied) handleGroupTextureChange(entries, { repeatX, repeatY });
  };

  const handleGroupPropsChange = (entries: MaterialEntry[], patch: GroupMaterialProps) => {
    setGroupChanges((prev) => {
      const next = { ...prev };
      entries.forEach((entry) => {
        const orig = (originalByUuid[entry.uuid] || originalByName[entry.name] || entry.hex).toUpperCase();
        const current = next[orig] || {};
        next[orig] = { ...current, props: { ...(current.props || {}), ...patch } };
      });
      return next;
    });
    applyGroupPropsLive(entries, patch);

    // Aktualizuj stan `materials`, żeby suwaki miały aktualną wartość i nie „odskakiwały”.
    setMaterials((prev) => {
      const uuids = new Set(entries.map((e) => e.uuid));
      return prev.map((m) => {
        if (!uuids.has(m.uuid)) return m;
        return { ...m, ...(patch as any) };
      });
    });
  };

  const handleResetGroup = (entries: MaterialEntry[]) => {
    entries.forEach((entry) => {
      if (replacedMapByUuid[entry.uuid]) restoreOriginalMap(entry.uuid);
      const original = originalByUuid[entry.uuid] || originalByName[entry.name];
      if (original) applyColorChange(scene, entry.uuid, original);
      const origTex = originalTextureByUuid[entry.uuid];
      if (origTex && entry.hasTexture) applyTextureChange(scene, entry.uuid, origTex);
    });
    setReplacedMapByUuid((prev) => {
      const next = { ...prev };
      entries.forEach((e) => delete next[e.uuid]);
      return next;
    });
    setMaterials((prev) => {
      const uuids = new Set(entries.map((e) => e.uuid));
      return prev.map((m) => {
        if (!uuids.has(m.uuid)) return m;
        const original = originalByUuid[m.uuid] || originalByName[m.name] || m.hex;
        const origTex = originalTextureByUuid[m.uuid];
        return {
          ...m,
          hex: original,
          ...(origTex && m.hasTexture ? { texture: { ...origTex } } : {})
        };
      });
    });
    setGroupChanges((prev) => {
      const next = { ...prev };
      entries.forEach((entry) => {
        const orig = (originalByUuid[entry.uuid] || originalByName[entry.name] || entry.hex).toUpperCase();
        delete next[orig];
      });
      return next;
    });
  };

  const handleResetAll = () => {
    materials.forEach((m) => {
      if (replacedMapByUuid[m.uuid]) restoreOriginalMap(m.uuid);
      const orig = originalByUuid[m.uuid] || originalByName[m.name];
      if (orig) applyColorChange(scene, m.uuid, orig);
      const origTex = originalTextureByUuid[m.uuid];
      if (origTex && m.hasTexture) applyTextureChange(scene, m.uuid, origTex);
    });
    setReplacedMapByUuid({});
    setMapPreviewByGroupId((prev) => {
      Object.values(prev).forEach((url) => {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      });
      return {};
    });
    setMaterials((prev) =>
      prev.map((m) => ({
        ...m,
        hex: originalByUuid[m.uuid] || originalByName[m.name] || m.hex,
        ...(originalTextureByUuid[m.uuid] && m.hasTexture
          ? { texture: { ...originalTextureByUuid[m.uuid] } }
          : {})
      }))
    );
    setGroupChanges({});
    setReplacedMapByUuid({});
    setHexDraftByGroupId({});
    setSaveError('');
    setSaveSuccess(false);
  };

  // 4) Paleta — dodawanie / usuwanie systemowych kolorów.
  const handleAddPaletteColor = async () => {
    const hex = normalizeHex(newColorHex);
    if (!hex) return;
    setPaletteLoading(true);
    try {
      const next = await addColor(hex, newColorName || undefined);
      setPalette(next);
      setNewColorName('');
    } catch (err) {
      console.error(err);
      alert('Błąd zapisu palety');
    } finally {
      setPaletteLoading(false);
    }
  };

  const handleRemovePaletteColor = async (hex: string) => {
    if (!confirm(`Usunąć kolor ${hex} z palety systemowej?`)) return;
    setPaletteLoading(true);
    try {
      const next = await removeColor(hex);
      setPalette(next);
    } catch (err) {
      console.error(err);
      alert('Błąd zapisu palety');
    } finally {
      setPaletteLoading(false);
    }
  };

  const handlePickFromPalette = (entries: MaterialEntry[], hex: string) => {
    handleGroupColorChange(entries, hex);
    setOpenPaletteFor(null);
  };

  const handleAddToPaletteFromBadge = async (hex: string) => {
    const normalized = normalizeHex(hex);
    setPaletteLoading(true);
    try {
      const next = await addColor(normalized, undefined);
      setPalette(next);
    } catch (err) {
      console.error(err);
      alert('Błąd zapisu palety');
    } finally {
      setPaletteLoading(false);
    }
  };

  // 5) Zapis do pliku GLB — fresh fetch, GLTFExporter, replaceBadgeFile.
  const handleSave = async () => {
    const changeCount = Object.keys(groupChanges).length;
    const mapReplaceCount = Object.keys(replacedMapByUuid).length;
    if (!badge || !scene || (changeCount === 0 && mapReplaceCount === 0)) return;
    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      const blob = await exportGLBFromScene(scene);

      const filePath = badge.file_path;
      if (!filePath) throw new Error('Brak file_path dla odznaki');

      await replaceBadgeFile(badge.id, filePath, blob);

      // Wyczyść cache useGLTF, żeby kolejny render pobrał świeży plik.
      try {
        useGLTF.clear(badge.url);
      } catch {}

      setSaveSuccess(true);
      // Po zapisie traktujemy nowe kolory jako "oryginalne" dla następnych edycji.
      // Aktualizujemy mapę oryginałów po uuid na podstawie obecnego stanu materiałów.
      setOriginalByUuid((prev) => {
        const next = { ...prev };
        materials.forEach((m) => {
          next[m.uuid] = m.hex;
        });
        return next;
      });
      setOriginalTextureByUuid((prev) => {
        const next = { ...prev };
        materials.forEach((m) => {
          if (m.texture) next[m.uuid] = { ...m.texture };
        });
        return next;
      });
      setGroupChanges({});
      setReplacedMapByUuid({});
      if (onSaved) await onSaved();
    } catch (err: any) {
      console.error('Zapis GLB nieudany:', err);
      setSaveError(err?.message || 'Nieznany błąd zapisu');
    } finally {
      setIsSaving(false);
    }
  };

  const dirtyCount =
    Object.keys(groupChanges).length + Object.keys(replacedMapByUuid).length;
  const hasMaterials = materials.length > 0;

  // Skrót klawiszowy: Z = Zapisz w pliku GLB (gdy panel aktywny).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() !== 'z') return;
      if (isSaving || dirtyCount === 0) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        (target as any)?.isContentEditable;
      if (isTyping) return;

      e.preventDefault();
      void handleSave();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dirtyCount, isSaving, badge?.id]);

  type ColorGroup = {
    id: string;
    hex: string;
    entries: MaterialEntry[];
    hasTexture: boolean;
    names: string[];
    isDirty: boolean;
    originalHexes: string[];
  };

  const groups: ColorGroup[] = useMemo(() => {
    const byHex = new Map<string, MaterialEntry[]>();
    materials.forEach((m) => {
      const key = normalizeHex(m.hex);
      const arr = byHex.get(key) || [];
      arr.push({ ...m, hex: key });
      byHex.set(key, arr);
    });

    const out: ColorGroup[] = [];
    Array.from(byHex.entries()).forEach(([hex, entries]) => {
      const hasTextureAny = entries.some((e) => e.hasTexture);
      const names = entries.map((e) => e.name).filter(Boolean);
      const isDirty =
        entries.some((e) => {
          const orig = (originalByUuid[e.uuid] || originalByName[e.name] || e.hex).toUpperCase();
          return groupChanges[orig] !== undefined;
        }) ||
        entries.some((e) => e.hasTexture && isGroupTextureDirty(entries)) ||
        entries.some((e) => replacedMapByUuid[e.uuid]);
      const originalHexes = Array.from(
        new Set(
          entries
            .map((e) => originalByUuid[e.uuid] || originalByName[e.name])
            .filter(Boolean) as string[]
        )
      );
      out.push({
        id: `${hex}-${entries.map((e) => e.uuid).join('-')}`,
        hex,
        entries,
        hasTexture: hasTextureAny,
        names,
        isDirty,
        originalHexes
      });
    });

    // Stabilne sortowanie (po hex) dla przewidywalności
    out.sort((a, b) => a.hex.localeCompare(b.hex));
    return out;
  }, [materials, groupChanges, originalByUuid, originalByName, originalTextureByUuid, replacedMapByUuid]);

  // Utrzymuj draft HEX dla grup (żeby dało się wpisać ręcznie bez zamykania natywnego pickera).
  useEffect(() => {
    setHexDraftByGroupId((prev) => {
      const next = { ...prev };
      groups.forEach((g) => {
        if (next[g.id] == null) next[g.id] = g.hex;
      });
      // Usuń drafty dla nieistniejących grup
      Object.keys(next).forEach((id) => {
        if (!groups.some((g) => g.id === id)) delete next[id];
      });
      return next;
    });
  }, [groups]);

  const palettePreview = useMemo(
    () => palette.colors.map((c) => ({ hex: c.hex, name: c.name })),
    [palette]
  );

  const paletteHexSet = useMemo(() => {
    return new Set(palette.colors.map((c) => normalizeHex(c.hex)));
  }, [palette.colors]);

  if (!badge) {
    return (
      <div className="p-6 text-blue-300/60 text-xs uppercase tracking-widest text-center">
        Wybierz odznakę, aby edytować jej kolory
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-white h-full min-h-0 overflow-hidden">
      <input
        ref={pngFileInputRef}
        type="file"
        accept="image/png,image/webp"
        className="hidden"
        onChange={(e) => void handlePngFileSelected(e.target.files?.[0])}
      />
      <div className="shrink-0 space-y-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-300 text-[10px] font-bold uppercase tracking-widest">
          <PaletteIcon className="w-3.5 h-3.5" />
          <span>Tryb admina · widoczne tylko dla Ciebie</span>
        </div>

      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
        <div className="flex items-center justify-between gap-2 sticky top-0 z-10 bg-blue-950/95 py-1 -mx-1 px-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-blue-200/70">
            Kolory tej odznaki ({groups.length})
          </div>
          {dirtyCount > 0 && (
            <button
              onClick={handleResetAll}
              className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-blue-200 hover:text-white px-2 py-1 rounded-md hover:bg-white/5"
            >
              <RotateCcw className="w-3 h-3" /> Cofnij wszystko
            </button>
          )}
        </div>

        <div className="space-y-2">
        {!hasMaterials && (
          <div className="text-blue-300/50 text-xs text-center py-6">
            Brak materiałów do edycji w tej odznace.
          </div>
        )}

        {groups.map((g) => {
          const showPalette = openPaletteFor === g.id;
          const showAdvanced = openAdvancedFor === g.id;
          const showTexture = openTextureFor === g.id;
          const currentTexture = getGroupCurrentTexture(g.entries);
          const textureDirty = g.hasTexture && isGroupTextureDirty(g.entries);
          const linkRepeat = textureLinkRepeat[g.id] !== false;
          const dragOnThis = dragGroupId === g.id;
          const groupOrig = getGroupOriginalHex(g.entries);
          const baseProps = getGroupCurrentProps(g.entries);
          const overrideProps = groupChanges[groupOrig]?.props || {};
          const currentProps: GroupMaterialProps = { ...baseProps, ...overrideProps };
          const supportsMetal = typeof currentProps.metalness === 'number' || typeof currentProps.roughness === 'number';
          const supportsGlass = typeof currentProps.transmission === 'number' || typeof currentProps.ior === 'number' || typeof currentProps.thickness === 'number';
          return (
            <div
              key={g.id}
              className={`rounded-xl border bg-white/5 transition-all ${
                g.isDirty ? 'border-amber-400/60' : 'border-white/10'
              }`}
            >
              <div className="flex items-center gap-2 p-2">
                <input
                  type="color"
                  value={g.hex}
                  onChange={(e) => handleGroupColorChange(g.entries, e.target.value)}
                  className="w-10 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer shrink-0"
                  title="Wybierz kolor"
                />
                <input
                  value={hexDraftByGroupId[g.id] ?? g.hex}
                  onChange={(e) => {
                    const v = e.target.value.toUpperCase();
                    setHexDraftByGroupId((prev) => ({ ...prev, [g.id]: v }));
                  }}
                  onBlur={() => {
                    const draft = (hexDraftByGroupId[g.id] ?? g.hex).trim();
                    // Akceptuj #RGB / #RRGGBB (z lub bez #)
                    const normalized = normalizeHex(draft);
                    setHexDraftByGroupId((prev) => ({ ...prev, [g.id]: normalized }));
                    handleGroupColorChange(g.entries, normalized);
                  }}
                  spellCheck={false}
                  inputMode="text"
                  className="w-[92px] px-2 py-1.5 rounded-lg bg-black/30 border border-white/10 text-[10px] font-mono uppercase tracking-widest text-white placeholder-blue-300/40 focus:outline-none focus:border-amber-400/50"
                  title="Wpisz HEX (np. #FACC15)"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate" title={g.names.join(', ')}>
                    {g.names.length > 0 ? (
                      <span>
                        {g.names.length === 1 ? g.names[0] : `${g.names[0]} + ${g.names.length - 1}`}
                      </span>
                    ) : (
                      <span>(bez nazwy)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-blue-300/70 font-mono uppercase">
                    {paletteHexSet.has(normalizeHex(g.hex)) && (
                      <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/20 text-amber-300 text-[9px] font-bold tracking-widest">
                        <Star className="w-3 h-3" /> SYS
                      </span>
                    )}
                    {g.isDirty && g.originalHexes.length > 0 && (
                      <span className="text-amber-400/80">
                        ← {g.originalHexes.length === 1 ? g.originalHexes[0] : `${g.originalHexes[0]}…`}
                      </span>
                    )}
                    {g.hasTexture && (
                      <span className="ml-1 inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-blue-500/10 border border-blue-400/20 text-blue-300 normal-case tracking-normal">
                        <ImageIcon className="w-2.5 h-2.5" /> tekstura
                      </span>
                    )}
                    <span className="ml-1 text-blue-200/50 normal-case tracking-normal">
                      ({g.entries.length})
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleAddToPaletteFromBadge(g.hex)}
                  title="Dodaj ten kolor do palety systemowej"
                  className="p-2 rounded-lg border bg-white/5 text-blue-200 border-white/10 hover:bg-white/10"
                >
                  <Plus className="w-3 h-3" />
                </button>
                {g.hasTexture && (
                  <button
                    onClick={() => setOpenTextureFor(showTexture ? null : g.id)}
                    title="Tekstura: skala, przesunięcie, obrót"
                    className={`p-2 rounded-lg border bg-white/5 border-white/10 hover:bg-white/10 ${
                      showTexture || textureDirty ? 'text-amber-300' : 'text-blue-200'
                    }`}
                  >
                    <ImageIcon className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => setOpenAdvancedFor(showAdvanced ? null : g.id)}
                  title="Zaawansowane: metal/szkło"
                  className={`p-2 rounded-lg border bg-white/5 border-white/10 hover:bg-white/10 ${
                    showAdvanced ? 'text-amber-300' : 'text-blue-200'
                  }`}
                >
                  <SlidersHorizontal className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setOpenPaletteFor(showPalette ? null : g.id)}
                  title="Wybierz z palety"
                  className={`p-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition ${
                    showPalette
                      ? 'bg-blue-500 text-white border-blue-400'
                      : 'bg-white/5 text-blue-200 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <ChevronDown className={`w-3 h-3 transition-transform ${showPalette ? 'rotate-180' : ''}`} />
                </button>
                {g.isDirty && (
                  <button
                    onClick={() => handleResetGroup(g.entries)}
                    title="Cofnij zmianę (grupa)"
                    className="p-2 rounded-lg border bg-white/5 text-blue-200 border-white/10 hover:bg-white/10"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>

              {showPalette && (
                <div className="px-2 pb-2">
                  {palettePreview.length === 0 ? (
                    <div className="text-[10px] text-blue-300/60 italic px-1 py-2">
                      Paleta jest pusta — dodaj kolor poniżej.
                    </div>
                  ) : (
                    <div className="grid grid-cols-8 gap-1.5">
                      {palettePreview.map((c) => (
                        <button
                          key={c.hex}
                          onClick={() => handlePickFromPalette(g.entries, c.hex)}
                          title={`${c.hex}${c.name ? ' · ' + c.name : ''}`}
                          className={`group relative w-full aspect-square rounded-md border-2 transition-all hover:scale-110 ${
                            g.hex === c.hex ? 'border-white' : 'border-white/20'
                          }`}
                          style={{ backgroundColor: c.hex }}
                        >
                          {g.hex === c.hex && (
                            <Check className="absolute inset-0 m-auto w-3 h-3 text-white drop-shadow" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {showTexture && g.hasTexture && (
                <div className="px-2 pb-3 space-y-3 border-t border-white/5 pt-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-blue-200/70 flex items-center gap-2">
                      <ImageIcon className="w-3 h-3" />
                      Tekstura (mapa)
                    </div>
                    {textureDirty && (
                      <button
                        type="button"
                        onClick={() => handleResetGroupTexture(g.entries, g.id)}
                        className="text-[9px] font-bold uppercase tracking-widest text-amber-300 hover:text-white"
                      >
                        Cofnij teksturę
                      </button>
                    )}
                  </div>

                  <div className="rounded-lg bg-violet-500/10 border border-violet-400/25 p-2.5 space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-violet-200/90 flex items-center gap-2">
                      <Upload className="w-3 h-3" />
                      Mapa PNG
                    </div>
                    <p className="text-[9px] text-blue-300/60 leading-relaxed">
                      Wgraj nowy plik PNG/WebP — zastąpi logo na podglądzie. Potem kliknij „Zapisz w pliku GLB”.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={pngUploading}
                        onClick={() => triggerPngUpload(g.entries, g.id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[9px] font-bold uppercase tracking-widest"
                      >
                        {pngUploading ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Upload className="w-3 h-3" />
                        )}
                        Wgraj PNG
                      </button>
                      {mapPreviewByGroupId[g.id] && (
                        <img
                          src={mapPreviewByGroupId[g.id]}
                          alt="Podgląd wgranego PNG"
                          className="h-10 w-10 rounded-md border border-white/20 object-contain bg-black/40"
                        />
                      )}
                      {g.entries.some((e) => replacedMapByUuid[e.uuid]) && (
                        <span className="text-[9px] text-violet-300 font-bold uppercase tracking-widest">
                          Nowa mapa
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg bg-black/30 border border-white/10 p-2.5 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-blue-200/80 flex items-center gap-2">
                        <MousePointer2 className="w-3 h-3" />
                        Przesuwanie myszką
                      </div>
                      <div className="text-[9px] text-blue-300/60 leading-relaxed mt-1">
                        Włącz, potem przeciągnij po odznace w podglądzie — przesunie się symbol/tekstura (offset X/Y).
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (dragOnThis) {
                          setDragGroupId(null);
                          dragEntriesRef.current = null;
                          endDrag();
                        } else {
                          setDragGroupId(g.id);
                          dragEntriesRef.current = g.entries;
                          endDrag();
                        }
                      }}
                      className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-[9px] font-bold uppercase tracking-widest transition ${
                        dragOnThis
                          ? 'bg-amber-500/90 text-black border-amber-400/60'
                          : 'bg-white/5 text-blue-200 border-white/10 hover:bg-white/10'
                      }`}
                      title="Przesuwaj teksturę myszką na podglądzie"
                    >
                      <Hand className="w-3 h-3" />
                      {dragOnThis ? 'AKTYWNE' : 'WŁĄCZ'}
                    </button>
                  </div>

                  <p className="text-[9px] text-blue-300/60 leading-relaxed">
                    Rozciągnięcie wzdłuż korygujesz osobno na osi pionowej i poziomej. Białe kreski przy
                    zmniejszaniu logo? Kliknij <strong className="text-emerald-300/90">Napraw obwódkę</strong>{' '}
                    (czyści RGB pod alphą w PNG).
                  </p>

                  <div className="rounded-lg bg-black/30 border border-amber-400/20 p-2.5 space-y-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-amber-200/90">
                      Korekta wzdłuż
                    </div>

                    <div className="space-y-2">
                      <div className="text-[9px] text-blue-300/80 flex items-center gap-1">
                        <ArrowDownUp className="w-3 h-3 shrink-0" />
                        Pion (za wysoka / wzdłuż ↕)
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => nudgeTextureStretch(g.entries, 'vertical', 'lessStretch')}
                          className="px-2 py-1.5 rounded-md bg-amber-500/15 border border-amber-400/30 text-[9px] font-bold uppercase tracking-widest text-amber-100 hover:bg-amber-500/25"
                          title="Zwiększa repeat Y — tekstura mniej rozciągnięta w pionie"
                        >
                          ↕ Mniej wzdłuż
                        </button>
                        <button
                          type="button"
                          onClick={() => nudgeTextureStretch(g.entries, 'vertical', 'moreStretch')}
                          className="px-2 py-1.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-widest text-blue-200 hover:bg-white/10"
                          title="Zmniejsza repeat Y — tekstura bardziej rozciągnięta w pionie"
                        >
                          ↕ Więcej wzdłuż
                        </button>
                      </div>
                      <label className="text-[10px] text-blue-200/70 uppercase tracking-widest block">
                        Siła Y względem X ({(currentTexture.repeatY / Math.max(currentTexture.repeatX, 0.001)).toFixed(2)})
                        <input
                          type="range"
                          min={0.15}
                          max={6}
                          step={0.02}
                          value={currentTexture.repeatY / Math.max(currentTexture.repeatX, 0.001)}
                          onChange={(e) =>
                            handleGroupTextureChange(g.entries, {
                              repeatY: clampRepeat(currentTexture.repeatX * Number(e.target.value))
                            })
                          }
                          className="w-full"
                        />
                        <span className="text-[8px] normal-case tracking-normal text-blue-300/50">
                          w prawo = mniej rozciągnięte w pionie
                        </span>
                      </label>
                    </div>

                    <div className="space-y-2 border-t border-white/10 pt-2">
                      <div className="text-[9px] text-blue-300/80 flex items-center gap-1">
                        <ArrowLeftRight className="w-3 h-3 shrink-0" />
                        Poziom (za szeroka / wzdłuż ↔)
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => nudgeTextureStretch(g.entries, 'horizontal', 'lessStretch')}
                          className="px-2 py-1.5 rounded-md bg-amber-500/15 border border-amber-400/30 text-[9px] font-bold uppercase tracking-widest text-amber-100 hover:bg-amber-500/25"
                          title="Zwiększa repeat X — tekstura mniej rozciągnięta w poziomie"
                        >
                          ↔ Mniej wzdłuż
                        </button>
                        <button
                          type="button"
                          onClick={() => nudgeTextureStretch(g.entries, 'horizontal', 'moreStretch')}
                          className="px-2 py-1.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-widest text-blue-200 hover:bg-white/10"
                          title="Zmniejsza repeat X"
                        >
                          ↔ Więcej wzdłuż
                        </button>
                      </div>
                      <label className="text-[10px] text-blue-200/70 uppercase tracking-widest block">
                        Siła X względem Y ({(currentTexture.repeatX / Math.max(currentTexture.repeatY, 0.001)).toFixed(2)})
                        <input
                          type="range"
                          min={0.15}
                          max={6}
                          step={0.02}
                          value={currentTexture.repeatX / Math.max(currentTexture.repeatY, 0.001)}
                          onChange={(e) =>
                            handleGroupTextureChange(g.entries, {
                              repeatX: clampRepeat(currentTexture.repeatY * Number(e.target.value))
                            })
                          }
                          className="w-full"
                        />
                        <span className="text-[8px] normal-case tracking-normal text-blue-300/50">
                          w prawo = mniej rozciągnięte w poziomie
                        </span>
                      </label>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleGroupTextureChange(g.entries, {
                            repeatY: clampRepeat(currentTexture.repeatY * 1.35)
                          })
                        }
                        className="px-2 py-1 rounded-md bg-amber-500/20 border border-amber-400/40 text-[9px] font-bold uppercase tracking-widest text-amber-50 hover:bg-amber-500/30"
                      >
                        Mocno ściśnij ↕
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleGroupTextureChange(g.entries, {
                            repeatX: clampRepeat(currentTexture.repeatX * 1.35)
                          })
                        }
                        className="px-2 py-1 rounded-md bg-amber-500/20 border border-amber-400/40 text-[9px] font-bold uppercase tracking-widest text-amber-50 hover:bg-amber-500/30"
                      >
                        Mocno ściśnij ↔
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleGroupTextureChange(g.entries, { ...DEFAULT_TEXTURE_TRANSFORM })}
                      className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-widest text-blue-200 hover:bg-white/10"
                    >
                      Reset 1×1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyImageAspectFix(g.entries)}
                      className="px-2 py-1 rounded-md bg-blue-500/20 border border-blue-400/30 text-[9px] font-bold uppercase tracking-widest text-blue-100 hover:bg-blue-500/30"
                    >
                      Proporcje pliku
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRepairTextureFringe(g.entries)}
                      className="px-2 py-1 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-[9px] font-bold uppercase tracking-widest text-emerald-100 hover:bg-emerald-500/30"
                      title="Usuwa białe/szare kreski z krawędzi PNG (defringe + bleed)"
                    >
                      Napraw obwódkę
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleGroupTextureChange(g.entries, {
                          repeatX: currentTexture.repeatY,
                          repeatY: currentTexture.repeatX
                        })
                      }
                      className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-widest text-blue-200 hover:bg-white/10"
                    >
                      Zamień X/Y
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] text-blue-200/70 uppercase tracking-widest col-span-2 flex items-center justify-between">
                      <span>Skala (repeat)</span>
                      <button
                        type="button"
                        onClick={() =>
                          setTextureLinkRepeat((prev) => ({ ...prev, [g.id]: !linkRepeat }))
                        }
                        className="inline-flex items-center gap-1 text-[9px] normal-case tracking-normal text-blue-300"
                        title={linkRepeat ? 'Rozłącz skalę X i Y' : 'Połącz skalę X i Y'}
                      >
                        {linkRepeat ? <Link2 className="w-3 h-3" /> : <Unlink2 className="w-3 h-3" />}
                        {linkRepeat ? 'razem' : 'osobno'}
                      </button>
                    </label>
                    <label className="text-[10px] text-blue-200/70 uppercase tracking-widest">
                      Repeat X
                      <input
                        type="range"
                        min={0.05}
                        max={8}
                        step={0.01}
                        value={currentTexture.repeatX}
                        onChange={(e) => {
                          const v = clampRepeat(Number(e.target.value));
                          handleGroupTextureChange(
                            g.entries,
                            linkRepeat ? { repeatX: v, repeatY: v } : { repeatX: v }
                          );
                        }}
                        className="w-full"
                      />
                    </label>
                    <label className="text-[10px] text-blue-200/70 uppercase tracking-widest">
                      Repeat Y
                      <input
                        type="range"
                        min={0.05}
                        max={8}
                        step={0.01}
                        value={currentTexture.repeatY}
                        onChange={(e) => {
                          const v = clampRepeat(Number(e.target.value));
                          handleGroupTextureChange(
                            g.entries,
                            linkRepeat ? { repeatX: v, repeatY: v } : { repeatY: v }
                          );
                        }}
                        className="w-full"
                      />
                    </label>
                    <label className="text-[10px] text-blue-200/70 uppercase tracking-widest">
                      Offset X
                      <input
                        type="range"
                        min={-2}
                        max={2}
                        step={0.01}
                        value={currentTexture.offsetX}
                        onChange={(e) =>
                          handleGroupTextureChange(g.entries, { offsetX: Number(e.target.value) })
                        }
                        className="w-full"
                      />
                    </label>
                    <label className="text-[10px] text-blue-200/70 uppercase tracking-widest">
                      Offset Y
                      <input
                        type="range"
                        min={-2}
                        max={2}
                        step={0.01}
                        value={currentTexture.offsetY}
                        onChange={(e) =>
                          handleGroupTextureChange(g.entries, { offsetY: Number(e.target.value) })
                        }
                        className="w-full"
                      />
                    </label>
                    <label className="text-[10px] text-blue-200/70 uppercase tracking-widest col-span-2">
                      Obrót ({Math.round((currentTexture.rotation * 180) / Math.PI)}°)
                      <input
                        type="range"
                        min={0}
                        max={360}
                        step={1}
                        value={Math.round((currentTexture.rotation * 180) / Math.PI)}
                        onChange={(e) =>
                          handleGroupTextureChange(g.entries, {
                            rotation: (Number(e.target.value) * Math.PI) / 180
                          })
                        }
                        className="w-full"
                      />
                    </label>
                  </div>

                  <label className="flex items-center gap-2 text-[10px] text-blue-200/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentTexture.flipY}
                      onChange={(e) =>
                        handleGroupTextureChange(g.entries, { flipY: e.target.checked })
                      }
                      className="rounded border-white/20"
                    />
                    <FlipVertical2 className="w-3 h-3" />
                    Odwróć pion (flipY) — często poprawia „do góry nogami”
                  </label>
                </div>
              )}

              {showAdvanced && (
                <div className="px-2 pb-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-blue-200/70 flex items-center gap-2">
                      <Shield className="w-3 h-3" />
                      Materiał (metal/szkło)
                    </div>
                    {presetsLoading && <Loader2 className="w-3 h-3 animate-spin text-blue-300" />}
                  </div>

                  {(supportsMetal || supportsGlass) ? (
                    <div className="space-y-3">
                      {supportsMetal && (
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-[10px] text-blue-200/70 uppercase tracking-widest">
                            Metalness
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.01}
                              value={typeof currentProps.metalness === 'number' ? currentProps.metalness : 0}
                              onChange={(e) => handleGroupPropsChange(g.entries, { metalness: clamp01(Number(e.target.value)) })}
                              className="w-full"
                            />
                          </label>
                          <label className="text-[10px] text-blue-200/70 uppercase tracking-widest">
                            Roughness
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.01}
                              value={typeof currentProps.roughness === 'number' ? currentProps.roughness : 0}
                              onChange={(e) => handleGroupPropsChange(g.entries, { roughness: clamp01(Number(e.target.value)) })}
                              className="w-full"
                            />
                          </label>
                        </div>
                      )}

                      {supportsGlass && (
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-[10px] text-blue-200/70 uppercase tracking-widest">
                            Transmission
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.01}
                              value={typeof currentProps.transmission === 'number' ? currentProps.transmission : 0}
                              onChange={(e) => handleGroupPropsChange(g.entries, { transmission: clamp01(Number(e.target.value)), transparent: true })}
                              className="w-full"
                            />
                          </label>
                          <label className="text-[10px] text-blue-200/70 uppercase tracking-widest">
                            Opacity
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.01}
                              value={typeof currentProps.opacity === 'number' ? currentProps.opacity : 1}
                              onChange={(e) => handleGroupPropsChange(g.entries, { opacity: clamp01(Number(e.target.value)), transparent: true })}
                              className="w-full"
                            />
                          </label>
                          <label className="text-[10px] text-blue-200/70 uppercase tracking-widest">
                            IOR
                            <input
                              type="range"
                              min={1}
                              max={2.5}
                              step={0.01}
                              value={typeof currentProps.ior === 'number' ? currentProps.ior : 1.5}
                              onChange={(e) => handleGroupPropsChange(g.entries, { ior: Number(e.target.value) })}
                              className="w-full"
                            />
                          </label>
                          <label className="text-[10px] text-blue-200/70 uppercase tracking-widest">
                            Thickness
                            <input
                              type="range"
                              min={0}
                              max={2}
                              step={0.01}
                              value={typeof currentProps.thickness === 'number' ? currentProps.thickness : 0.5}
                              onChange={(e) => handleGroupPropsChange(g.entries, { thickness: Number(e.target.value) })}
                              className="w-full"
                            />
                          </label>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <select
                          value={selectedPresetByGroupId[g.id] || ''}
                          onChange={(e) => setSelectedPresetByGroupId((prev) => ({ ...prev, [g.id]: e.target.value }))}
                          className="flex-1 px-2 py-1.5 text-xs bg-white/5 border border-white/10 rounded-md text-white focus:outline-none"
                        >
                          <option value="">Presety systemowe…</option>
                          {materialPresets.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <button
                          disabled={!selectedPresetByGroupId[g.id]}
                          onClick={() => {
                            const preset = materialPresets.find((p) => p.id === selectedPresetByGroupId[g.id]);
                            if (preset) applyPresetToGroup(g.entries, preset);
                          }}
                          className="px-2.5 py-1.5 rounded-md bg-blue-500 hover:bg-blue-400 text-white text-[10px] font-bold uppercase tracking-widest disabled:opacity-40"
                          title="Zastosuj preset"
                        >
                          <GlassWater className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newPresetName}
                          onChange={(e) => setNewPresetName(e.target.value)}
                          placeholder="Nazwa presetu (systemowy)"
                          className="flex-1 px-2 py-1.5 text-xs bg-white/5 border border-white/10 rounded-md text-white placeholder-blue-300/40 focus:outline-none"
                        />
                        <button
                          onClick={() => handleSavePresetFromGroup(newPresetName, {
                            metalness: currentProps.metalness,
                            roughness: currentProps.roughness,
                            opacity: currentProps.opacity,
                            transparent: currentProps.transparent,
                            transmission: currentProps.transmission,
                            ior: currentProps.ior,
                            thickness: currentProps.thickness
                          })}
                          className="px-2.5 py-1.5 rounded-md bg-amber-400 hover:bg-amber-300 text-blue-950 text-[10px] font-bold uppercase tracking-widest"
                          title="Zapisz jako preset systemowy"
                        >
                          <Star className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-blue-300/60 italic">
                      Ta grupa nie ma materiałów z parametrami metal/szkło (albo są nierozpoznane).
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        </div>

        <div className="border-t border-white/10 pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-widest text-blue-200/70">
            Paleta systemowa ({palette.colors.length})
          </div>
          {paletteLoading && <Loader2 className="w-3 h-3 animate-spin text-blue-300" />}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {palette.colors.map((c) => (
            <div
              key={c.hex}
              className="group relative w-7 h-7 rounded-md border border-white/20"
              style={{ backgroundColor: c.hex }}
              title={`${c.hex}${c.name ? ' · ' + c.name : ''}`}
            >
              <button
                onClick={() => handleRemovePaletteColor(c.hex)}
                className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 opacity-0 group-hover:opacity-100 flex items-center justify-center transition"
                title="Usuń z palety"
              >
                <Trash2 className="w-2 h-2 text-white" />
              </button>
            </div>
          ))}
          {palette.colors.length === 0 && !paletteLoading && (
            <div className="text-[10px] text-blue-300/50 italic">
              Brak kolorów — dodaj pierwszy.
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="color"
            value={newColorHex}
            onChange={(e) => setNewColorHex(e.target.value)}
            className="w-8 h-8 rounded-md border border-white/10 bg-transparent cursor-pointer shrink-0"
          />
          <input
            type="text"
            value={newColorName}
            onChange={(e) => setNewColorName(e.target.value)}
            placeholder="Nazwa (opcjonalnie)"
            className="flex-1 min-w-0 px-2 py-1.5 text-xs bg-white/5 border border-white/10 rounded-md text-white placeholder-blue-300/40 focus:outline-none focus:border-blue-400/50"
          />
          <button
            onClick={handleAddPaletteColor}
            disabled={paletteLoading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-blue-500 hover:bg-blue-400 text-white text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
          >
            <Plus className="w-3 h-3" /> Dodaj
          </button>
        </div>
      </div>

      <div className="border-t border-white/10 pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-widest text-blue-200/70">
            Presety materiału ({materialPresets.length})
          </div>
          {presetsLoading && <Loader2 className="w-3 h-3 animate-spin text-blue-300" />}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {materialPresets.map((p) => (
            <button
              key={p.id}
              onClick={() => handleRemovePreset(p.id)}
              className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-blue-200 hover:bg-red-500/10 hover:border-red-400/30 hover:text-red-200 transition"
              title="Kliknij, aby usunąć preset"
            >
              {p.name}
            </button>
          ))}
          {materialPresets.length === 0 && !presetsLoading && (
            <div className="text-[10px] text-blue-300/50 italic">
              Brak presetów — dodaj je w „Zaawansowane” przy kolorze.
            </div>
          )}
        </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-white/10 pt-3 space-y-2 bg-blue-950/90">
        {saveError && (
          <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-[10px]">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate" title={saveError}>{saveError}</span>
          </div>
        )}
        {saveSuccess && !saveError && (
          <div className="flex items-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-[10px]">
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>Zapisano w pliku GLB.</span>
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={isSaving || dirtyCount === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-400 hover:bg-amber-300 text-blue-950 rounded-xl font-anton text-xs uppercase tracking-widest shadow-xl disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Zapisywanie GLB…
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Zapisz w pliku GLB{dirtyCount > 0 ? ` (${dirtyCount})` : ''}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default BadgeColorPanel;

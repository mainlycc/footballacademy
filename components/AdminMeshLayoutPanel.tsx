import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  LayoutGrid,
  Plus,
  RotateCcw,
  Save,
  Trash2
} from 'lucide-react';
import { Badge } from '../types';
import { exportGLB } from '../utils/glbColorEditor';
import { replaceBadgeFile } from '../db';
import {
  alignMeshGroups,
  buildAllMeshBaseline,
  collectAllMeshTransformChanges,
  distributeMeshGroups,
  findObjectByPath,
  nudgeMeshesInPlane,
  type AlignMode,
  type CustomLayoutGroup,
  type LayoutAxis
} from '../utils/glbMeshLayout';

const NUDGE_STEPS = [0.01, 0.02, 0.05, 0.1] as const;

interface Props {
  badge: Badge | null;
  scene: THREE.Object3D | null;
  marqueeSelectedMeshes: Set<string>;
  onMarqueeMeshesChange: (paths: Set<string>) => void;
  onSaved?: () => void | Promise<void>;
}

const GROUP_HIGHLIGHT = 0x33aa66;
const MARQUEE_HIGHLIGHT = 0x4488ff;
const HIGHLIGHT_INTENSITY = 0.4;

const AdminMeshLayoutPanel: React.FC<Props> = ({
  badge,
  scene,
  marqueeSelectedMeshes,
  onMarqueeMeshesChange,
  onSaved
}) => {
  const [customGroups, setCustomGroups] = useState<CustomLayoutGroup[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [nudgeStep, setNudgeStep] = useState<number>(0.02);
  const baselineRef = useRef<Record<string, [number, number, number]>>({});
  const highlightBackupRef = useRef<
    Map<string, { emissive?: THREE.Color; emissiveIntensity?: number }>
  >(new Map());
  const nextGroupId = useRef(1);

  useEffect(() => {
    if (!scene) {
      setCustomGroups([]);
      setSelectedGroupIds(new Set());
      baselineRef.current = {};
      onMarqueeMeshesChange(new Set());
      return;
    }
    baselineRef.current = buildAllMeshBaseline(scene);
    setCustomGroups([]);
    setSelectedGroupIds(new Set());
    onMarqueeMeshesChange(new Set());
    nextGroupId.current = 1;
    setSaveSuccess(false);
    setSaveError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset zaznaczenia przy nowej odznace
  }, [scene, badge?.id]);

  const selectedGroups = useMemo(
    () => customGroups.filter((g) => selectedGroupIds.has(g.id)),
    [customGroups, selectedGroupIds]
  );

  /** Fragmenty do przesuwania: prostokąt + zaznaczone grupy (checkbox). */
  const activeMeshPaths = useMemo(() => {
    const paths = new Set<string>();
    marqueeSelectedMeshes.forEach((p) => paths.add(p));
    selectedGroups.forEach((g) => g.meshPaths.forEach((p) => paths.add(p)));
    return Array.from(paths);
  }, [marqueeSelectedMeshes, selectedGroups]);

  const canNudge = activeMeshPaths.length > 0;

  const dirtyCount = useMemo(() => {
    if (!scene) return 0;
    return collectAllMeshTransformChanges(scene, baselineRef.current).length;
  }, [scene, layoutVersion]);

  const bumpLayout = useCallback(() => setLayoutVersion((v) => v + 1), []);

  const toggleGroupSelect = (id: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateGroupFromMarquee = () => {
    if (marqueeSelectedMeshes.size === 0) return;
    const id = `custom-${nextGroupId.current++}`;
    const name = `Grupa ${customGroups.length + 1}`;
    setCustomGroups((prev) => [
      ...prev,
      { id, name, meshPaths: Array.from(marqueeSelectedMeshes) }
    ]);
    setSelectedGroupIds((prev) => new Set(prev).add(id));
    onMarqueeMeshesChange(new Set());
  };

  const handleNudge = useCallback(
    (axis: 'x' | 'y', direction: -1 | 1) => {
      if (!scene || activeMeshPaths.length === 0) return;
      nudgeMeshesInPlane(scene, activeMeshPaths, axis, direction, nudgeStep);
      bumpLayout();
    },
    [scene, activeMeshPaths, nudgeStep, bumpLayout]
  );

  const handleDeleteGroup = (id: string) => {
    setCustomGroups((prev) => prev.filter((g) => g.id !== id));
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const runLayout = (fn: () => void) => {
    if (!scene || selectedGroups.length < 2) return;
    fn();
    bumpLayout();
  };

  const handleDistribute = (axis: LayoutAxis) => {
    runLayout(() =>
      distributeMeshGroups(
        scene!,
        selectedGroups.map((g) => g.meshPaths),
        axis
      )
    );
  };

  const handleAlign = (axis: LayoutAxis, mode: AlignMode) => {
    runLayout(() =>
      alignMeshGroups(
        scene!,
        selectedGroups.map((g) => g.meshPaths),
        axis,
        mode
      )
    );
  };

  const handleResetPositions = () => {
    if (!scene || dirtyCount === 0) return;
    if (!confirm('Cofnąć wszystkie zmiany pozycji?')) return;
    Object.entries(baselineRef.current).forEach(([path, pos]) => {
      const node = findObjectByPath(scene, path);
      if (node) node.position.set(pos[0], pos[1], pos[2]);
    });
    bumpLayout();
  };

  const handleSave = async () => {
    if (!badge || !scene || dirtyCount === 0) return;
    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      const transformChanges = collectAllMeshTransformChanges(scene, baselineRef.current);
      const blob = await exportGLB({
        originalUrl: badge.url,
        changes: [],
        transformChanges
      });
      const filePath = badge.file_path;
      if (!filePath) throw new Error('Brak file_path dla odznaki');
      await replaceBadgeFile(badge.id, filePath, blob);
      try {
        useGLTF.clear(badge.url);
      } catch {}
      baselineRef.current = buildAllMeshBaseline(scene);
      setSaveSuccess(true);
      bumpLayout();
      if (onSaved) await onSaved();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Błąd zapisu układu');
    } finally {
      setIsSaving(false);
    }
  };

  const applyHighlight = (meshPath: string, hex: number) => {
    if (!scene) return;
    const node = findObjectByPath(scene, meshPath);
    if (!(node instanceof THREE.Mesh)) return;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    mats.forEach((mat) => {
      if (
        !(mat instanceof THREE.MeshStandardMaterial) &&
        !(mat instanceof THREE.MeshPhysicalMaterial)
      ) {
        return;
      }
      if (!highlightBackupRef.current.has(meshPath)) {
        highlightBackupRef.current.set(meshPath, {
          emissive: mat.emissive.clone(),
          emissiveIntensity: mat.emissiveIntensity
        });
      }
      mat.emissive.setHex(hex);
      mat.emissiveIntensity = HIGHLIGHT_INTENSITY;
      mat.needsUpdate = true;
    });
  };

  const restoreHighlight = (meshPath: string) => {
    if (!scene) return;
    const backup = highlightBackupRef.current.get(meshPath);
    if (!backup) return;
    const node = findObjectByPath(scene, meshPath);
    if (!(node instanceof THREE.Mesh)) return;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    mats.forEach((mat) => {
      if (
        !(mat instanceof THREE.MeshStandardMaterial) &&
        !(mat instanceof THREE.MeshPhysicalMaterial)
      ) {
        return;
      }
      if (backup.emissive) mat.emissive.copy(backup.emissive);
      if (backup.emissiveIntensity !== undefined) {
        mat.emissiveIntensity = backup.emissiveIntensity;
      }
      mat.needsUpdate = true;
    });
    highlightBackupRef.current.delete(meshPath);
  };

  useEffect(() => {
    if (!scene) return;
    [...highlightBackupRef.current.keys()].forEach((p) => restoreHighlight(p));

    const marqueeOnly = new Set(marqueeSelectedMeshes);
    selectedGroups.forEach((g) => g.meshPaths.forEach((p) => marqueeOnly.delete(p)));

    marqueeOnly.forEach((p) => applyHighlight(p, MARQUEE_HIGHLIGHT));
    selectedGroups.forEach((g) => g.meshPaths.forEach((p) => applyHighlight(p, GROUP_HIGHLIGHT)));

    return () => {
      [...highlightBackupRef.current.keys()].forEach((p) => restoreHighlight(p));
    };
  }, [scene, marqueeSelectedMeshes, selectedGroups]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
        if (dirtyCount === 0 || isSaving) return;
        e.preventDefault();
        void handleSave();
        return;
      }

      if (!canNudge) return;
      const stepMul = e.shiftKey ? 5 : 1;
      const d = nudgeStep * stepMul;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        nudgeMeshesInPlane(scene!, activeMeshPaths, 'x', -1, d);
        bumpLayout();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nudgeMeshesInPlane(scene!, activeMeshPaths, 'x', 1, d);
        bumpLayout();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        nudgeMeshesInPlane(scene!, activeMeshPaths, 'y', 1, d);
        bumpLayout();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        nudgeMeshesInPlane(scene!, activeMeshPaths, 'y', -1, d);
        bumpLayout();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dirtyCount, isSaving, badge?.id, canNudge, scene, activeMeshPaths, nudgeStep, bumpLayout]);

  if (!badge) {
    return (
      <div className="p-6 text-blue-300/60 text-xs uppercase tracking-widest text-center">
        Wybierz odznakę, aby edytować układ
      </div>
    );
  }

  const needTwoGroups = selectedGroups.length < 2;

  return (
    <div className="flex flex-col gap-3 text-white h-full min-h-0 overflow-hidden">
      <div className="shrink-0 space-y-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-300 text-[10px] font-bold uppercase tracking-widest">
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Układ · zaznaczanie prostokątem</span>
        </div>
        <p className="text-[10px] text-blue-200/60 leading-relaxed px-1">
          Na podglądzie odznaki przeciągnij prostokąt — zaznaczą się fragmenty w środku. Potem
          utwórz grupę i wyrównaj kilka grup naraz.
        </p>
      </div>

      <div className="shrink-0 rounded-xl border border-blue-400/30 bg-blue-500/10 p-3 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-blue-200">
          Zaznaczenie: {marqueeSelectedMeshes.size} fragmentów
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={marqueeSelectedMeshes.size === 0}
            onClick={handleCreateGroupFromMarquee}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black text-[9px] font-bold uppercase tracking-widest"
          >
            <Plus className="w-3 h-3" /> Utwórz grupę
          </button>
          <button
            type="button"
            disabled={marqueeSelectedMeshes.size === 0}
            onClick={() => onMarqueeMeshesChange(new Set())}
            className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 text-[9px] font-bold uppercase tracking-widest"
          >
            Wyczyść
          </button>
        </div>
      </div>

      <div className="shrink-0 rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-blue-200">
          Przesuń w płaszczyźnie ({activeMeshPaths.length} fragm.)
        </div>
        <div className="grid grid-cols-3 gap-1 w-[8.5rem] mx-auto">
          <span />
          <button
            type="button"
            disabled={!canNudge}
            onClick={() => handleNudge('y', 1)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 flex justify-center"
            title="Góra (Y+)"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <span />
          <button
            type="button"
            disabled={!canNudge}
            onClick={() => handleNudge('x', -1)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 flex justify-center"
            title="Lewo (X-)"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="flex items-center justify-center text-[8px] text-blue-300/50 font-mono">
            XY
          </span>
          <button
            type="button"
            disabled={!canNudge}
            onClick={() => handleNudge('x', 1)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 flex justify-center"
            title="Prawo (X+)"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <span />
          <button
            type="button"
            disabled={!canNudge}
            onClick={() => handleNudge('y', -1)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 flex justify-center"
            title="Dół (Y-)"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <span />
        </div>
        <div className="flex flex-wrap gap-1 justify-center">
          {NUDGE_STEPS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setNudgeStep(s)}
              className={`px-2 py-1 rounded text-[8px] font-bold font-mono ${
                nudgeStep === s
                  ? 'bg-amber-500 text-black'
                  : 'bg-white/10 text-blue-200 hover:bg-white/15'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="text-[9px] text-blue-300/50 text-center">
          Strzałki klawiatury · Shift = większy krok
        </p>
      </div>

      <div className="shrink-0 flex gap-1 flex-wrap">
        <button
          type="button"
          disabled={needTwoGroups}
          onClick={() => handleDistribute('x')}
          className="flex-1 min-w-[7rem] px-2 py-2 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 text-[9px] font-bold uppercase tracking-widest"
        >
          Równy odstęp X
        </button>
        <button
          type="button"
          disabled={needTwoGroups}
          onClick={() => handleDistribute('y')}
          className="flex-1 min-w-[7rem] px-2 py-2 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 text-[9px] font-bold uppercase tracking-widest"
        >
          Równy odstęp Y
        </button>
      </div>

      <div className="shrink-0 flex gap-1 flex-wrap">
        <button
          type="button"
          disabled={needTwoGroups}
          onClick={() => handleAlign('x', 'center')}
          className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 text-[8px] font-bold uppercase tracking-widest"
        >
          Wyrównaj X
        </button>
        <button
          type="button"
          disabled={needTwoGroups}
          onClick={() => handleAlign('y', 'center')}
          className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 text-[8px] font-bold uppercase tracking-widest"
        >
          Wyrównaj Y
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1">
        <div className="text-[10px] font-bold uppercase tracking-widest text-blue-200/70 sticky top-0 bg-blue-950/95 py-1 z-10">
          Twoje grupy ({customGroups.length}) · do układu: {selectedGroups.length}
        </div>
        {customGroups.length === 0 && (
          <div className="text-blue-300/50 text-xs text-center py-6">
            Zaznacz prostokątem fragmenty (np. piłkę) i kliknij „Utwórz grupę”. Powtórz dla
            kolejnych elementów.
          </div>
        )}
        {customGroups.map((g) => {
          const isOn = selectedGroupIds.has(g.id);
          return (
            <div
              key={g.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                isOn
                  ? 'border-amber-400/50 bg-amber-400/10'
                  : 'border-white/5 bg-white/5'
              }`}
            >
              <input
                type="checkbox"
                checked={isOn}
                onChange={() => toggleGroupSelect(g.id)}
                className="accent-amber-400"
              />
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-medium truncate">{g.name}</span>
                <span className="block text-[9px] text-blue-300/50">
                  {g.meshPaths.length} fragmentów
                </span>
              </span>
              <button
                type="button"
                onClick={() => handleDeleteGroup(g.id)}
                className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-300"
                title="Usuń grupę"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-white/10 pt-3 space-y-2">
        {dirtyCount > 0 && (
          <button
            type="button"
            onClick={handleResetPositions}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest text-blue-200 hover:text-white hover:bg-white/5"
          >
            <RotateCcw className="w-3 h-3" /> Cofnij zmiany ({dirtyCount} meshów)
          </button>
        )}
        {saveError && <p className="text-red-400 text-[10px]">{saveError}</p>}
        {saveSuccess && (
          <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
            Zapisano układ w pliku GLB
          </p>
        )}
        <button
          type="button"
          disabled={dirtyCount === 0 || isSaving}
          onClick={() => void handleSave()}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold uppercase text-[10px] tracking-widest"
        >
          {isSaving ? (
            'Zapisywanie…'
          ) : (
            <>
              <Save className="w-4 h-4" /> Zapisz układ (Ctrl+Z)
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default AdminMeshLayoutPanel;

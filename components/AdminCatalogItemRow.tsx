import React, { useEffect, useMemo, useState } from 'react';
import { Link2, Loader2, RotateCcw, Save } from 'lucide-react';
import { Badge } from '../types';
import { BadgeItem } from '../data';
import { findMatchingBadge, normalize } from '../utils/badgeMatching';
import { updateBadgeName } from '../db';

interface Props {
  item: BadgeItem;
  itemKey: string;
  badges: Badge[];
  hasOverride: boolean;
  saving: boolean;
  onSaveOverride: (key: string, badge: string, label?: string) => Promise<void>;
  onClearOverride: (key: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

const AdminCatalogItemRow: React.FC<Props> = ({
  item,
  itemKey,
  badges,
  hasOverride,
  saving,
  onSaveOverride,
  onClearOverride,
  onRefresh,
}) => {
  const effectiveLabel = typeof item === 'string' ? item : item.label;
  const effectiveBadge = typeof item === 'object' ? item.badge : '';
  const matched = findMatchingBadge(item, badges);

  const [badgeDraft, setBadgeDraft] = useState(effectiveBadge || '');
  const [labelDraft, setLabelDraft] = useState(effectiveLabel);
  const [assignId, setAssignId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    setBadgeDraft(effectiveBadge || '');
    setLabelDraft(effectiveLabel);
  }, [itemKey, effectiveBadge, effectiveLabel]);

  const assignOptions = useMemo(
    () =>
      [...badges]
        .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
        .map((b) => ({ id: b.id, name: b.name })),
    [badges]
  );

  const targetName = badgeDraft.trim();
  const canSave =
    targetName.length > 0 &&
    (targetName !== (effectiveBadge || '') || labelDraft.trim() !== effectiveLabel);

  const handleSave = async () => {
    setLocalError('');
    if (!targetName) {
      setLocalError('Podaj nazwę pliku odznaki.');
      return;
    }
    try {
      await onSaveOverride(itemKey, targetName, labelDraft.trim() || undefined);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Błąd zapisu.');
    }
  };

  const handleAssign = async () => {
    setLocalError('');
    if (!assignId || !targetName) {
      setLocalError('Wybierz plik i ustaw nazwę dopasowania.');
      return;
    }
    const taken = badges.some(
      (b) => b.id !== assignId && normalize(b.name) === normalize(targetName)
    );
    if (taken) {
      setLocalError('Inny plik ma już tę nazwę — najpierw zmień lub usuń duplikat.');
      return;
    }
    setAssigning(true);
    try {
      await updateBadgeName(assignId, targetName);
      await onRefresh();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Błąd przypisania.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-amber-400/20 space-y-2">
      <div className="text-[9px] font-bold uppercase tracking-widest text-amber-300/90">
        Admin · klucz dopasowania
        {hasOverride && (
          <span className="ml-2 text-violet-300">(nadpisane)</span>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-[8px] uppercase tracking-widest text-blue-300/60 block mb-1">
            Nazwa na liście
          </label>
          <input
            type="text"
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            className="w-full px-2 py-1.5 rounded-lg bg-black/40 border border-white/15 text-white text-xs focus:border-amber-400/50 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[8px] uppercase tracking-widest text-blue-300/60 block mb-1">
            Nazwa pliku odznaki (dopasowanie)
          </label>
          <input
            type="text"
            value={badgeDraft}
            onChange={(e) => setBadgeDraft(e.target.value)}
            placeholder="np. Wprawny drybler Owen"
            className="w-full px-2 py-1.5 rounded-lg bg-black/40 border border-white/15 text-white text-xs focus:border-amber-400/50 focus:outline-none"
          />
        </div>
      </div>

      <div className="text-[9px] text-blue-300/70">
        {matched ? (
          <span className="text-emerald-400">
            Przypisany plik: <strong className="text-white">{matched.name}</strong>
          </span>
        ) : targetName ? (
          <span className="text-amber-300">Brak pliku o tej nazwie w bazie</span>
        ) : (
          <span>Ustaw nazwę pliku, aby dopasować odznakę 3D</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !canSave}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/90 hover:bg-amber-400 text-blue-950 text-[9px] font-bold uppercase tracking-widest disabled:opacity-40"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Zapisz nazwę
        </button>
        {hasOverride && (
          <button
            type="button"
            onClick={() => void onClearOverride(itemKey)}
            disabled={saving}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/15 text-blue-200 text-[9px] font-bold uppercase tracking-widest hover:bg-white/5 disabled:opacity-40"
          >
            <RotateCcw className="w-3 h-3" /> Przywróć z katalogu
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <select
          value={assignId}
          onChange={(e) => setAssignId(e.target.value)}
          className="flex-1 min-w-[140px] px-2 py-1.5 rounded-lg bg-black/40 border border-white/15 text-white text-[11px] focus:outline-none focus:border-violet-400/50"
        >
          <option value="">— wybierz plik z bazy —</option>
          {assignOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void handleAssign()}
          disabled={assigning || !assignId || !targetName}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[9px] font-bold uppercase tracking-widest disabled:opacity-40"
        >
          {assigning ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Link2 className="w-3 h-3" />
          )}
          Przypisz plik
        </button>
      </div>

      {localError && <p className="text-[9px] text-red-300">{localError}</p>}
      <p className="text-[8px] text-blue-300/50 leading-relaxed">
        Zapisz nową nazwę dopasowania, potem wybierz istniejący GLB i kliknij „Przypisz plik” (zmieni
        nazwę w chmurze).
      </p>
    </div>
  );
};

export default AdminCatalogItemRow;

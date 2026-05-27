import React from 'react';
import { Sun, RotateCcw } from 'lucide-react';
import type { BadgeLightingConfig, BadgeVec3 } from '../utils/badgeLightingConfig';

type Props = {
  config: BadgeLightingConfig;
  onChange: (patch: Partial<BadgeLightingConfig>) => void;
  onReset: () => void;
};

function SliderRow(props: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const { label, min, max, step, value, onChange } = props;
  return (
    <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-widest text-blue-200/80">
      <div className="flex justify-between gap-2">
        <span>{label}</span>
        <span className="tabular-nums text-white/90">{value.toFixed(step < 0.05 ? 2 : 1)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-amber-400 h-1.5"
      />
    </label>
  );
}

function Vec3Sliders(props: {
  title: string;
  value: BadgeVec3;
  onChange: (next: BadgeVec3) => void;
  min?: number;
  max?: number;
}) {
  const { title, value, onChange, min = -12, max = 12 } = props;
  const setAxis = (i: 0 | 1 | 2, v: number) => {
    const n: [number, number, number] = [value[0], value[1], value[2]];
    n[i] = v;
    onChange(n);
  };
  const axes: { i: 0 | 1 | 2; label: string }[] = [
    { i: 0, label: 'X' },
    { i: 1, label: 'Y' },
    { i: 2, label: 'Z' },
  ];
  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="text-[9px] font-bold uppercase tracking-widest text-amber-200/90">{title}</div>
      {axes.map(({ i, label }) => (
        <SliderRow
          key={label}
          label={`${title} · ${label}`}
          min={min}
          max={max}
          step={0.25}
          value={value[i]}
          onChange={(v) => setAxis(i, v)}
        />
      ))}
    </div>
  );
}

const AdminLightingPanel: React.FC<Props> = ({ config, onChange, onReset }) => {
  return (
    <div className="flex flex-col gap-3 text-white min-h-0 flex-1 overflow-y-auto pr-1">
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-300 text-[10px] font-bold uppercase tracking-widest shrink-0">
        <Sun className="w-3.5 h-3.5" />
        <span>Światło 3D · zapis lokalny (cała aplikacja)</span>
      </div>

      <p className="text-[10px] text-blue-200/70 leading-relaxed px-1">
        Jeśli detale znikają przy świetle „z przodu”, podnieś <strong className="text-white/90">światło otoczenia</strong> albo
        <strong className="text-white/90"> wypełniające</strong> — drugie źródło z boku / z tyłu odsłania wgłębienia bez cienia na podłożu.
      </p>

      <div className="flex items-center justify-end gap-2 shrink-0">
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-blue-200 hover:text-white px-2 py-1.5 rounded-lg border border-white/10 hover:bg-white/5"
        >
          <RotateCcw className="w-3 h-3" /> Domyślne
        </button>
      </div>

      <div className="space-y-3 text-[10px]">
        <div className="text-[9px] font-bold uppercase tracking-widest text-blue-300/80 px-1">Stan spoczynku (isLit = wył.)</div>
        <SliderRow label="Ambient" min={0} max={1.2} step={0.02} value={config.ambientDark} onChange={(v) => onChange({ ambientDark: v })} />
        <SliderRow
          label="Kierunkowe — moc"
          min={0}
          max={2.5}
          step={0.02}
          value={config.dirIntensityDark}
          onChange={(v) => onChange({ dirIntensityDark: v })}
        />
        <Vec3Sliders title="Kierunkowe — pozycja" value={config.dirPosDark} onChange={(v) => onChange({ dirPosDark: v })} />
        <SliderRow label="HDR otoczenia" min={0} max={1.5} step={0.02} value={config.envDark} onChange={(v) => onChange({ envDark: v })} />
        <SliderRow
          label="Cień kontaktowy"
          min={0}
          max={0.8}
          step={0.02}
          value={config.contactOpacityDark}
          onChange={(v) => onChange({ contactOpacityDark: v })}
        />
        <SliderRow
          label="Wypełniające — moc"
          min={0}
          max={1.5}
          step={0.02}
          value={config.fillIntensityDark}
          onChange={(v) => onChange({ fillIntensityDark: v })}
        />
        <Vec3Sliders title="Wypełniające — pozycja" value={config.fillPosDark} onChange={(v) => onChange({ fillPosDark: v })} />
      </div>

      <div className="space-y-3 text-[10px] border-t border-white/10 pt-3">
        <div className="text-[9px] font-bold uppercase tracking-widest text-blue-300/80 px-1">Podświetlenie (isLit = wł.)</div>
        <SliderRow label="Ambient" min={0} max={1.5} step={0.02} value={config.ambientLit} onChange={(v) => onChange({ ambientLit: v })} />
        <SliderRow
          label="Kierunkowe — moc"
          min={0}
          max={3}
          step={0.02}
          value={config.dirIntensityLit}
          onChange={(v) => onChange({ dirIntensityLit: v })}
        />
        <Vec3Sliders title="Kierunkowe — pozycja" value={config.dirPosLit} onChange={(v) => onChange({ dirPosLit: v })} />
        <SliderRow label="HDR otoczenia" min={0} max={1.5} step={0.02} value={config.envLit} onChange={(v) => onChange({ envLit: v })} />
        <SliderRow
          label="Cień kontaktowy"
          min={0}
          max={0.9}
          step={0.02}
          value={config.contactOpacityLit}
          onChange={(v) => onChange({ contactOpacityLit: v })}
        />
        <SliderRow
          label="Wypełniające — moc"
          min={0}
          max={1.5}
          step={0.02}
          value={config.fillIntensityLit}
          onChange={(v) => onChange({ fillIntensityLit: v })}
        />
        <Vec3Sliders title="Wypełniające — pozycja" value={config.fillPosLit} onChange={(v) => onChange({ fillPosLit: v })} />
      </div>
    </div>
  );
};

export default AdminLightingPanel;

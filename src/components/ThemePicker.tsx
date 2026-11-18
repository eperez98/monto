import clsx from 'clsx';
import { DEFAULT_PALETTE, type Palette, type Preferences } from '../db/types';
import { ChoiceCard } from './ui';
import { tr } from '../lib/i18n';

const THEMES: Array<{ v: Palette; label: () => string; desc: () => string; swatch: string }> = [
  { v: 'glass', label: () => tr('Cristal'), desc: () => tr('El diseño base: paneles translúcidos sobre color suave'), swatch: 'radial-gradient(60% 70% at 20% 20%,#B3A6FF,transparent 70%),radial-gradient(60% 70% at 85% 30%,#8FDCF7,transparent 70%),radial-gradient(60% 70% at 70% 95%,#F6B8DD,transparent 70%),#EEF0FA' },
  { v: 'skeuo', label: () => tr('Relieve'), desc: () => tr('Materiales reales: papel, cuero y botones con volumen'), swatch: 'linear-gradient(160deg,#8F5E30,#6E4321 55%,#4E2E15)' },
  { v: 'violet', label: () => tr('Violeta'), desc: () => tr('El diseño de la 0.7'), swatch: 'linear-gradient(135deg,#7B5CFF,#5B3FE0 45%,#2E1D86)' },
  { v: 'classic', label: () => tr('Clásico'), desc: () => tr('El verde original de Monto'), swatch: 'linear-gradient(145deg,#1D4636,#0F241B 55%,#0B1A14)' },
  { v: 'win11', label: () => tr('Windows 11'), desc: () => tr('Acrílico, Mica y el azul de Windows'), swatch: 'linear-gradient(135deg,#0067C0,#004A99 55%,#003070)' },
];

/** Pick the colour theme; `only` limits the list (the new-version panel shows just the new ones). */
export function ThemePicker({ value, onChange, only, oneColumn }: { value?: Palette; onChange: (p: Palette) => void; only?: Palette[]; oneColumn?: boolean }) {
  const current = value ?? DEFAULT_PALETTE;
  return (
    <div className={clsx('grid grid-cols-1 gap-3', !oneColumn && 'sm:grid-cols-2')}>
      {THEMES.filter((t) => !only || only.includes(t.v)).map((t) => {
        const sel = current === t.v;
        return (
          <button key={t.v} type="button" aria-pressed={sel} onClick={() => onChange(t.v)}
            className={clsx('flex items-center gap-3 rounded-[18px] border p-3 text-left transition', sel ? 'border-brand ring-4 ring-brand/12 bg-brand-soft/40' : 'border-line bg-surface hover:bg-surface-2')}>
            <span className="h-12 w-20 shrink-0 rounded-[12px] border border-white/40" style={{ background: t.swatch }} />
            <span className="min-w-0"><span className="block text-[13px] font-semibold text-ink">{t.label()}</span><span className="block text-[11.5px] text-muted">{t.desc()}</span></span>
          </button>
        );
      })}
    </div>
  );
}

/** Light, dark or follow Windows. */
export function ModePicker({ value, onChange }: { value: Preferences['theme']; onChange: (v: Preferences['theme']) => void }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {([['light', 'sun', tr('Claro')], ['dark', 'moon', tr('Oscuro')], ['system', 'monitor', tr('Sistema')]] as const).map(([v, i, l]) => <ChoiceCard key={v} selected={value === v} onClick={() => onChange(v)} icon={i} title={l} />)}
    </div>
  );
}

import { ChoiceCard } from '../../components/ui';
import { tr } from '../../lib/i18n';
import type { DashboardStyle } from './Dashboard';

const STYLES: Array<[DashboardStyle, string, string, string]> = [
  ['today', 'calendar', tr('Hoy'), tr('Una sola respuesta: cuánto puedes gastar hoy. El detalle, si lo pides.')],
  ['stories', 'sparkle', tr('Historias'), tr('Frases cortas sobre lo importante, cada una con su acción.')],
  ['calm', 'dashboard', tr('Capas tranquilas'), tr('Tres números, un gráfico y tus pendientes.')],
];

/** How the summary page looks; chosen in the initial setup and in Settings → Appearance. */
export function StylePicker({ value, onChange }: { value: DashboardStyle; onChange: (v: DashboardStyle) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label={tr('Estilo del resumen')}>
      {STYLES.map(([v, icon, title, desc]) => <ChoiceCard key={v} selected={value === v} onClick={() => onChange(v)} icon={icon} title={title} description={desc} />)}
    </div>
  );
}

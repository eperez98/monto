import { Button, IconButton, Modal, Toggle } from '../../components/ui';
import { moveCard, type DashCard, type DashCardPref } from '../../domain/dashboardCards';
import { tr } from '../../lib/i18n';

export const CARD_LABEL: Record<DashCard, () => string> = {
  balances: () => tr('Saldo, gasto y balance del período'),
  recap: () => tr('Tu mes en resumen (primeros días del mes)'),
  quick: () => tr('Accesos rápidos'),
  chart: () => tr('Gráfico de ingresos y gastos'),
  pending: () => tr('Pagos pendientes'),
  goals: () => tr('Objetivos de ahorro'),
};

/** Choose which cards the summary shows and in what order. */
export function CardsCustomizer({ open, onClose, cards, onChange }: { open: boolean; onClose: () => void; cards: DashCardPref[]; onChange: (c: DashCardPref[]) => void }) {
  return (
    <Modal open={open} onClose={onClose} title={tr('Personalizar el resumen')} subtitle={tr('Elige qué tarjetas ves y en qué orden.')} footer={<Button onClick={onClose}>{tr('Listo')}</Button>}>
      <ol className="space-y-2" aria-label={tr('Tarjetas del resumen')}>
        {cards.map((c, i) => (
          <li key={c.key} className="flex items-center gap-2 rounded-[14px] border border-line px-3 py-2">
            <div className="flex-1"><Toggle checked={c.on} onChange={(on) => onChange(cards.map((x) => (x.key === c.key ? { ...x, on } : x)))} label={CARD_LABEL[c.key]()} /></div>
            <IconButton icon="chevronDown" size={32} className="rotate-180" label={tr('Subir {name}', { name: CARD_LABEL[c.key]() })} onClick={() => onChange(moveCard(cards, i, -1))} />
            <IconButton icon="chevronDown" size={32} label={tr('Bajar {name}', { name: CARD_LABEL[c.key]() })} onClick={() => onChange(moveCard(cards, i, 1))} />
          </li>
        ))}
      </ol>
    </Modal>
  );
}

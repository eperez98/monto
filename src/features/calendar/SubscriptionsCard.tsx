import { useCan, useMutate, useProfile, useQuery, useScope } from '../../hooks/useDb';
import { listRecurring, createRecurring } from '../../db/repo/planning';
import { getSetting, setSetting } from '../../db/repo/core';
import { listTransactions } from '../../db/repo/finance';
import { detectSubscriptions } from '../../domain/subscriptions';
import { RECUR_LABEL } from '../../domain/recurrence';
import { Button, Card, CardHeader, IconButton, Money } from '../../components/ui';
import { Icon } from '../../icons';
import { addDays, formatDate, today } from '../../lib/dates';
import { combined, formatMoney, zeroTotals } from '../../lib/money';
import { tr } from '../../lib/i18n';

const IGNORED = 'ignoredSubscriptions';

/** Calendar → "Subscriptions found": repeating charges in the movements that aren't programmed yet. */
export function SubscriptionsCard() {
  const sf = useScope();
  const profile = useProfile();
  const canCreate = useCan('tx.create');
  const mutate = useMutate();
  const found = useQuery((e) => {
    const txs = listTransactions(e, { scope: sf, types: ['expense'], from: addDays(today(), -800), limit: 5000 });
    return detectSubscriptions(txs, today(), listRecurring(e, sf).map((r) => r.description), getSetting<string[]>(e, IGNORED, []));
  }, [sf.scope, sf.memberId]);
  if (!found.length) return null;
  const monthly = zeroTotals();
  for (const s of found) monthly[s.currency] += s.monthly;

  return (
    <Card hover={false}>
      <CardHeader title={tr('Suscripciones detectadas')} subtitle={tr('Cargos que se repiten en tus movimientos: unos {amount} al mes', { amount: formatMoney(combined(monthly, profile.primaryCurrency), profile.primaryCurrency) })} />
      <ul className="p-3 space-y-1">
        {found.map((s) => (
          <li key={s.key + s.currency} className="flex items-center gap-2.5 rounded-[12px] px-2.5 py-2 hover:bg-surface-2">
            <Icon name="repeat" size={16} className="text-brand shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-medium truncate">{s.description}</p>
              <p className="text-[11px] text-muted">{tr('{frequency} · {count} pagos · próximo {date}', { frequency: RECUR_LABEL[s.frequency], count: s.count, date: formatDate(s.nextDate) })}</p>
            </div>
            <Money cents={s.amount} currency={s.currency} className="text-[12.5px] font-semibold" />
            {canCreate && s.accountId && (
              <Button size="sm" variant="secondary" onClick={() => mutate((e, a) => createRecurring(e, a, { kind: 'expense', description: s.description, amount: s.amount, currency: s.currency, accountId: s.accountId!, categoryId: s.categoryId, frequency: s.frequency, startDate: s.nextDate, autoPost: false, scope: sf.scope }), tr('Pago recurrente programado'))}>{tr('Programar')}</Button>
            )}
            {canCreate && <IconButton icon="close" size={26} label={tr('No es una suscripción')} onClick={() => mutate((e) => setSetting(e, IGNORED, [...getSetting<string[]>(e, IGNORED, []), s.key]), tr('No volverá a aparecer'))} />}
          </li>
        ))}
      </ul>
      <p className="px-5 pb-4 text-[11px] text-muted">{tr('Según tu historial: el mismo comercio, un monto parecido y un ritmo constante. «Programar» la agrega a tus pagos recurrentes para que Monto te la recuerde.')}</p>
    </Card>
  );
}

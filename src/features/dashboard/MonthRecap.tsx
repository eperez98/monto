import { useState } from 'react';
import clsx from 'clsx';
import { useQuery } from '../../hooks/useDb';
import { monthRecapData } from '../../db/repo/analytics';
import { buildMonthRecap } from '../../domain/monthRecap';
import { Button, Card, IconButton, Modal, Money } from '../../components/ui';
import { Icon } from '../../icons';
import { addMonths, formatDate, formatMonth, startOfMonth, today } from '../../lib/dates';
import type { Currency } from '../../lib/money';
import type { ScopeFilter } from '../../db/types';
import { tr } from '../../lib/i18n';

const lastMonth = () => startOfMonth(addMonths(today(), -1));

/** Card on the summary during the first days of a month: last month at a glance, with a button to see it all. */
export function MonthRecapCard({ sf, currency, delay = 0 }: { sf: ScopeFilter; currency: Currency; delay?: number }) {
  const [open, setOpen] = useState(false);
  const month = lastMonth();
  const r = buildMonthRecap(useQuery((e) => monthRecapData(e, month, sf), [month, sf]));
  if (r.verdict === 'empty') return null;
  return (
    <>
      <Card delay={delay} hover={false} className="p-5 flex flex-wrap items-center gap-4">
        <span className="grid place-items-center size-11 rounded-[14px] bg-brand-soft text-brand"><Icon name="sparkle" size={20} /></span>
        <div className="flex-1 min-w-[180px]">
          <p className="text-[14px] font-semibold">{tr('Tu mes en resumen: {month}', { month: formatMonth(month.slice(0, 7)) })}</p>
          <p className="text-[12.5px] text-muted">
            {r.saved >= 0 ? <>{tr('Ahorraste')}{' '}<Money cents={r.saved} currency={currency} className="font-semibold text-emerald" /></> : <>{tr('Gastaste')}{' '}<Money cents={-r.saved} currency={currency} className="font-semibold text-coral" />{' '}{tr('más de lo que ingresó')}</>}
            {r.expenseChange !== null && <>{' · '}{r.expenseChange <= 0 ? tr('{n} % menos gasto que el mes anterior', { n: -r.expenseChange }) : tr('{n} % más gasto que el mes anterior', { n: r.expenseChange })}</>}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>{tr('Ver tu mes')}</Button>
      </Card>
      <MonthRecapModal open={open} onClose={() => setOpen(false)} month={month} sf={sf} currency={currency} />
    </>
  );
}

export function MonthRecapModal({ open, onClose, month: initial, sf, currency }: { open: boolean; onClose: () => void; month: string; sf: ScopeFilter; currency: Currency }) {
  const [month, setMonth] = useState(initial);
  const r = buildMonthRecap(useQuery((e) => monthRecapData(e, month, sf), [month, sf]));
  const isLast = month >= lastMonth();
  const max = Math.max(r.income, r.expense, 1);
  const headline = r.verdict === 'saved' ? tr('Cerraste el mes ahorrando') : r.verdict === 'even' ? tr('Cerraste el mes justo') : r.verdict === 'overspent' ? tr('Este mes gastaste más de lo que ingresó') : tr('No hay movimientos este mes');
  return (
    <Modal open={open} onClose={() => { onClose(); setMonth(initial); }} width={560} title={tr('Tu mes en resumen')} subtitle={formatMonth(month.slice(0, 7))} footer={<Button onClick={() => { onClose(); setMonth(initial); }}>{tr('Listo')}</Button>}>
      <div className="flex items-center justify-between -mt-1 mb-4">
        <IconButton icon="chevronDown" size={32} className="rotate-90" label={tr('Mes anterior')} onClick={() => setMonth(startOfMonth(addMonths(month, -1)))} />
        <span className="text-[13px] font-medium">{formatMonth(month.slice(0, 7))}</span>
        {isLast ? <span className="size-8" /> : <IconButton icon="chevronDown" size={32} className="-rotate-90" label={tr('Mes siguiente')} onClick={() => setMonth(startOfMonth(addMonths(month, 1)))} />}
      </div>
      {r.verdict === 'empty' ? (
        <p className="rounded-[18px] bg-surface-2 p-6 text-center text-[13px] text-muted">{tr('No registraste movimientos en este mes. Usa las flechas para ver otro.')}</p>
      ) : (
      <div className="space-y-5">
        <section className="rounded-[22px] hero-surface text-white p-6 text-center">
          <p className="text-[13px] text-white/80">{headline}</p>
          <Money cents={Math.abs(r.saved)} currency={currency} className="block text-[40px] font-semibold tracking-[-0.05em] mt-1" />
          {r.rate !== null && <p className="text-[12.5px] text-white/75 mt-1">{r.rate >= 0 ? tr('Guardaste el {n} % de lo que ingresó', { n: r.rate }) : tr('Faltó el {n} % de lo que ingresó', { n: -r.rate })}</p>}
        </section>
        <section aria-label={tr('Ingresos y gastos')} className="space-y-2.5">
          {([[tr('Ingresos'), r.income, 'bg-emerald'], [tr('Gastos'), r.expense, 'bg-coral']] as const).map(([label, v, color]) => (
            <div key={label}>
              <div className="flex justify-between text-[12.5px] mb-1"><span className="text-muted">{label}</span><Money cents={v} currency={currency} className="font-semibold" /></div>
              <div className="h-2.5 rounded-full bg-surface-3 overflow-hidden"><div className={clsx('h-full rounded-full', color)} style={{ width: `${(v / max) * 100}%` }} /></div>
            </div>
          ))}
          {r.expenseChange !== null && <p className="text-[12px] text-muted">{r.expenseChange <= 0 ? tr('{n} % menos gasto que el mes anterior', { n: -r.expenseChange }) : tr('{n} % más gasto que el mes anterior', { n: r.expenseChange })}</p>}
        </section>
        {r.top.length > 0 && (
          <section>
            <p className="text-[13px] font-semibold mb-2">{tr('En qué se fue tu dinero')}</p>
            <ol className="space-y-2">
              {r.top.map((c) => (
                <li key={c.name} className="flex items-center gap-3 text-[13px]">
                  <span className="size-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-muted w-10 text-right">{c.share} %</span>
                  <Money cents={c.amount} currency={currency} className="w-28 text-right font-medium" />
                </li>
              ))}
            </ol>
          </section>
        )}
        <section className="grid grid-cols-2 gap-3 text-[12.5px]">
          <div className="rounded-[16px] bg-surface-2 p-3"><p className="text-muted">{tr('Movimientos registrados')}</p><p className="text-[18px] font-semibold num">{r.count}</p></div>
          {r.biggest && <div className="rounded-[16px] bg-surface-2 p-3 min-w-0"><p className="text-muted">{tr('Gasto más grande')}</p><p className="font-semibold truncate">{r.biggest.description}</p><p className="text-muted"><Money cents={r.biggest.amount} currency={currency} />{' · '}{formatDate(r.biggest.date)}</p></div>}
        </section>
      </div>
      )}
    </Modal>
  );
}

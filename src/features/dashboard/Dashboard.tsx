import { motion } from 'motion/react';
import clsx from 'clsx';
import { useApp } from '../../store/app';
import { useActor, useCan, useProfile, useQuery, useScope, useMutate } from '../../hooks/useDb';
import { useRange } from '../../hooks/useRange';
import { alerts, balances, dismissAlert, expensesByCategory, monthlySeries, totals, upcoming } from '../../db/repo/analytics';
import { listTransactions, listCategories, listAccounts } from '../../db/repo/finance';
import { listGoals, listIncomeSources, incomeSummary } from '../../db/repo/planning';
import { Card, CardHeader, Money, Progress, Badge, EmptyState, Button, EstimateTag, IconButton, useMotionOK } from '../../components/ui';
import { IncomeExpenseBars, CategoryDonut } from '../../components/charts';
import { AlertRow } from '../../components/layout/Notifications';
import { TxRow } from '../transactions/TxRow';
import { Icon, IconTile } from '../../icons';
import { combined, formatMoney, pct } from '../../lib/money';
import { formatDate, diffDays, today } from '../../lib/dates';
import { savingsRate } from '../../domain/insights';
import { lang, tr } from '../../lib/i18n';

function Delta({ cur, prev, inverse }: { cur: number; prev: number; inverse?: boolean }) {
  if (!prev) return <span className="text-[11px] text-muted">{tr('Sin datos del periodo anterior')}</span>;
  const d = ((cur - prev) / Math.abs(prev)) * 100;
  const good = inverse ? d <= 0 : d >= 0;
  return (
    <span className={clsx('inline-flex items-center gap-1 text-[11.5px] font-semibold', good ? 'text-emerald' : 'text-coral')}>
      <Icon name={d >= 0 ? 'arrowUpRight' : 'arrowDownLeft'} size={13} strokeWidth={2.2} />{Math.abs(d).toFixed(0)} % <span className="font-normal text-muted">{tr('vs. anterior')}</span>
    </span>
  );
}

function QuickAction({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-2.5 h-11 pl-1.5 pr-4 rounded-full bg-surface border border-line/70 shadow-card text-[13px] font-medium text-ink hover:border-brand/40 hover:bg-brand-soft/40 transition active:scale-[0.97]">
      <span className="grid place-items-center size-8 rounded-full bg-brand-soft text-brand"><Icon name={icon} size={16} strokeWidth={2} /></span>{label}
    </button>
  );
}

export default function Dashboard() {
  const profile = useProfile();
  const actor = useActor();
  const sf = useScope();
  const { range, prev, label } = useRange();
  const go = useApp((s) => s.go);
  const openTx = useApp((s) => s.openTx);
  const mutate = useMutate();
  const canCreate = useCan('tx.create');
  const ok = useMotionOK();
  const cur = profile.primaryCurrency;
  const visibleTo = profile.mode === 'individual' ? undefined : sf.scope === 'personal' ? actor.id : undefined;

  const t = useQuery((e) => totals(e, range, sf), [range, sf]);
  const p = useQuery((e) => totals(e, prev, sf), [prev, sf]);
  const bal = useQuery((e) => balances(e, visibleTo, profile.mode !== 'individual' && sf.scope === 'family'), [visibleTo, sf.scope]);
  const series = useQuery((e) => monthlySeries(e, 6, sf), [sf]);
  const cats = useQuery((e) => expensesByCategory(e, range, sf), [range, sf]);
  const recent = useQuery((e) => listTransactions(e, { scope: sf, limit: 6 }), [sf]);
  const categories = useQuery((e) => listCategories(e, undefined, true));
  const accounts = useQuery((e) => listAccounts(e, { includeArchived: true }));
  const goals = useQuery((e) => listGoals(e, sf).filter((g) => !g.completedAt).slice(0, 3), [sf]);
  const next = useQuery((e) => upcoming(e, sf, 30), [sf]);
  const al = useQuery((e) => alerts(e, sf).slice(0, 4), [sf]);
  const income = useQuery((e) => (sf.scope === 'personal' ? listIncomeSources(e, actor.id).map((s) => incomeSummary(e, s)) : []), [sf, actor.id]);

  const available = combined(bal.available, cur);
  const rate = savingsRate(t.income, t.expense);
  const estMonthly = income.reduce((a, s) => a + s.estimate.monthlyNet, 0);
  const nextPay = income.map((s) => s.next).filter(Boolean).sort((a, b) => a!.date.localeCompare(b!.date))[0];

  if (!accounts.length) {
    return (
      <Card className="mt-6"><EmptyState icon="bank" title={tr('Crea tu primera cuenta')} body={tr('Añade una cuenta bancaria, efectivo o tarjeta para empezar a registrar movimientos.')} action={<Button icon="plus" onClick={() => go('accounts')}>{tr('Añadir cuenta')}</Button>} /></Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Row 1 */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 xl:col-span-6 space-y-4">
          <motion.section data-tour="hero" initial={ok ? { opacity: 0, y: 14 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-[28px] hero-surface text-white p-6 shadow-pop min-h-[210px]">
            <div className="relative flex items-center justify-between">
              <span className="text-[20px] font-extrabold tracking-[-0.05em] text-white/90">monto</span>
              <span className="text-[12px] text-white/75">{tr('Saldo disponible')}{sf.scope === 'family' ? tr(' · Hogar') : ''}</span>
            </div>
            <Money animated cents={available} currency={cur} className="relative block text-[44px] font-semibold tracking-[-0.05em] leading-tight mt-4" />
            <div className="relative flex flex-wrap gap-x-6 gap-y-1 mt-1 text-[12px] text-white/75">
              <span>{tr('PAB')}{' '}<Money cents={bal.available.PAB} currency="PAB" className="text-white font-semibold" /></span>
              <span>{tr('USD')}{' '}<Money cents={bal.available.USD} currency="USD" className="text-white font-semibold" /></span>
              {(bal.cardDebt.PAB + bal.cardDebt.USD) > 0 && <span>{tr('Deuda en tarjetas')}{' '}<Money cents={combined(bal.cardDebt, cur)} currency={cur} className="text-[#FFC2CC] font-semibold" /></span>}
            </div>
            <div className="relative mt-6 -mx-6 -mb-6 px-6 py-3.5 bg-black/20 backdrop-blur flex items-center justify-between gap-3 text-[12px]">
              <span className="text-white/80 truncate">{tr('Balance de')}{' '}{lang === 'es' ? label.toLowerCase() : label} · <Money cents={t.net} currency={cur} sign className="text-white font-semibold" /></span>
              <span className={clsx('inline-flex items-center gap-1 h-7 px-2.5 rounded-full font-semibold shrink-0', t.net >= 0 ? 'bg-white/15 text-white' : 'bg-[#FF6F86]/25 text-[#FFC2CC]')}>
                <Icon name={t.net >= 0 ? 'arrowUpRight' : 'arrowDownLeft'} size={13} strokeWidth={2.2} />{rate.toFixed(0)}{' '}{tr('% ahorro')}
              </span>
            </div>
          </motion.section>
          {canCreate && (
            <div className="flex flex-wrap gap-2" data-tour="quick">
              <QuickAction icon="arrowDownLeft" label={tr('Gasto')} onClick={() => openTx('expense')} />
              <QuickAction icon="arrowUpRight" label={tr('Ingreso')} onClick={() => openTx('income')} />
              <QuickAction icon="transfer" label={tr('Transferir')} onClick={() => openTx('transfer')} />
              <QuickAction icon="savings" label={tr('Plan mensual')} onClick={() => go('plan')} />
            </div>
          )}
        </div>

        <Card delay={0.06} className="col-span-6 xl:col-span-3 p-5 flex flex-col">
          <div className="flex items-start justify-between"><p className="text-[12.5px] text-muted">{tr('Ingresos')}</p><span className="grid place-items-center size-8 rounded-full bg-emerald-soft text-emerald"><Icon name="arrowUpRight" size={15} strokeWidth={2.2} /></span></div>
          <Money animated cents={t.income} currency={cur} className="text-[30px] font-semibold tracking-[-0.045em] mt-auto pt-6" />
          <div className="mt-1 flex items-center justify-between gap-2"><Delta cur={t.income} prev={p.income} /></div>
          {estMonthly > 0 && <p className="text-[11px] text-muted mt-2 flex flex-wrap items-center gap-1.5 whitespace-nowrap">{tr('Estimado mensual')}{' '}<Money cents={estMonthly} currency={cur} className="font-semibold text-ink-2" /> <EstimateTag /></p>}
        </Card>

        <Card delay={0.12} className="col-span-6 xl:col-span-3 p-5 flex flex-col">
          <div className="flex items-start justify-between"><p className="text-[12.5px] text-muted">{tr('Gastos')}</p><span className="grid place-items-center size-8 rounded-full bg-coral-soft text-coral"><Icon name="arrowDownLeft" size={15} strokeWidth={2.2} /></span></div>
          <Money animated cents={t.expense} currency={cur} className="text-[30px] font-semibold tracking-[-0.045em] mt-auto pt-6" />
          <div className="mt-1"><Delta cur={t.expense} prev={p.expense} inverse /></div>
          <p className="text-[11px] text-muted mt-2">{cats[0] ? <>{tr('Mayor gasto:')}{' '}<span className="font-semibold text-ink-2">{cats[0].name}</span></> : tr('Sin gastos en el periodo')}</p>
        </Card>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-12 gap-5">
        <Card delay={0.15} className="col-span-12 xl:col-span-7">
          <CardHeader title={tr('Ingresos y gastos')} subtitle={tr('Últimos 6 meses')} action={<div className="flex gap-3 text-[11px] text-muted"><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-brand" />{tr('Ingresos')}</span><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-sage" />{tr('Gastos')}</span></div>} />
          <div className="px-3 pb-3">{series.some((s) => s.income || s.expense) ? <IncomeExpenseBars data={series} currency={cur} /> : <EmptyState icon="reports" title={tr('Aún no hay datos')} body={tr('Registra ingresos y gastos para ver tu evolución.')} />}</div>
        </Card>
        <Card delay={0.2} className="col-span-12 xl:col-span-5" >
          <CardHeader title={tr('Distribución de gastos')} subtitle={label} action={<IconButton icon="chevronRight" label={tr('Ver informes')} onClick={() => go('reports')} size={30} />} />
          {cats.length ? (
            <div className="flex items-center gap-5 p-5 pt-3">
              <CategoryDonut data={cats.slice(0, 7)} currency={cur} size={190} />
              <ul className="flex-1 space-y-2 min-w-0">
                {cats.slice(0, 6).map((c) => (
                  <li key={c.categoryId} className="flex items-center gap-2 text-[12.5px]">
                    <span className="size-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                    <span className="truncate text-ink-2">{c.name}</span>
                    <span className="ml-auto text-muted num">{pct(c.amount, t.expense || 1).toFixed(0)}%</span>
                    <Money cents={c.amount} currency={cur} compact className="w-20 text-right font-semibold" />
                  </li>
                ))}
              </ul>
            </div>
          ) : <EmptyState icon="budget" title={tr('Sin gastos en este periodo')} body={tr('Cuando registres gastos verás aquí su distribución por categoría.')} />}
        </Card>
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-12 gap-5">
        <Card delay={0.24} className="col-span-12 xl:col-span-5">
          <CardHeader title={tr('Últimos movimientos')} action={<Button variant="ghost" size="sm" onClick={() => go('transactions')}>{tr('Ver todos')}</Button>} />
          <div className="p-2">
            {recent.length ? recent.map((tx, i) => <TxRow key={tx.id} tx={tx} categories={categories} accounts={accounts} index={i} onClick={() => openTx(undefined, tx)} />)
              : <EmptyState icon="transactions" title={tr('Sin movimientos')} body={tr('Registra tu primer ingreso o gasto.')} action={<Button size="sm" icon="plus" onClick={() => openTx()}>{tr('Registrar')}</Button>} />}
          </div>
        </Card>

        <div className="col-span-12 xl:col-span-4 space-y-5">
          <motion.div initial={ok ? { opacity: 0, y: 14 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.5 }} className="rounded-[26px] hero-surface text-white p-5 shadow-card relative overflow-hidden">
                        {nextPay ? (
              <>
                <p className="text-[11.5px] text-white/60 flex items-center gap-2">{tr('Próximo cobro')}{' '}<EstimateTag /></p>
                <p className="text-[26px] font-semibold tracking-[-0.04em] mt-2">{formatDate(nextPay.date, 'long').replace(/ de \d{4}$/, '')}</p>
                <p className="text-[12.5px] text-white/70 mt-1">{nextPay.label} · <Money cents={nextPay.net} currency={cur} className="text-[#E4E0FF] font-semibold" />{' '}{tr('· en')}{' '}{Math.max(0, diffDays(nextPay.date, today()))}{' '}{tr('días')}</p>
              </>
            ) : next[0] ? (
              <>
                <p className="text-[11.5px] text-white/60">{tr('Próximo pago')}</p>
                <p className="text-[26px] font-semibold tracking-[-0.04em] mt-2">{formatDate(next[0].date, 'long').replace(/ de \d{4}$/, '')}</p>
                <p className="text-[12.5px] text-white/70 mt-1">{next[0].title} · <Money cents={next[0].amount} currency={next[0].currency} /></p>
              </>
            ) : (
              <><p className="text-[11.5px] text-white/60">{tr('Calendario')}</p><p className="text-[18px] font-semibold mt-2">{tr('Sin pagos próximos')}</p><p className="text-[12px] text-white/60 mt-1">{tr('Programa tus gastos recurrentes en el calendario.')}</p></>
            )}
          </motion.div>
          <Card delay={0.32}>
            <CardHeader title={tr('Próximos pagos')} subtitle={tr('30 días')} action={<IconButton icon="calendar" label={tr('Calendario')} onClick={() => go('calendar')} size={30} />} />
            <ul className="p-2">
              {next.filter((n) => n.kind !== 'income').slice(0, 4).map((n, i) => (
                <li key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-[14px] hover:bg-surface-2">
                  <div className="w-10 text-center"><p className="text-[16px] font-semibold leading-none num">{n.date.slice(8)}</p><p className="text-[10px] text-muted uppercase">{formatDate(n.date, 'day').split(' ')[1]}</p></div>
                  <p className="flex-1 text-[13px] text-ink truncate">{n.title}</p>
                  <Money cents={n.amount} currency={n.currency} className="text-[13px] font-semibold" />
                </li>
              ))}
              {!next.filter((n) => n.kind !== 'income').length && <p className="px-3 py-4 text-[12.5px] text-muted">{tr('No hay pagos programados.')}</p>}
            </ul>
          </Card>
        </div>

        <div className="col-span-12 xl:col-span-3 space-y-5">
          <Card delay={0.34}>
            <CardHeader title={tr('Objetivos')} action={<IconButton icon="chevronRight" label={tr('Objetivos')} onClick={() => go('goals')} size={30} />} />
            <div className="p-5 pt-3 space-y-4">
              {goals.map((g, i) => (
                <div key={g.id}>
                  <div className="flex items-center justify-between text-[12.5px] mb-1.5"><span className="font-medium truncate">{g.name}</span><span className="text-muted num">{pct(g.saved, g.target).toFixed(0)}%</span></div>
                  <Progress value={pct(g.saved, g.target)} color={g.color} delay={0.3 + i * 0.1} />
                  <p className="text-[11px] text-muted mt-1"><Money cents={g.saved} currency={g.currency} />{' '}{tr('de')}{' '}<Money cents={g.target} currency={g.currency} /></p>
                </div>
              ))}
              {!goals.length && <p className="text-[12.5px] text-muted">{tr('Crea un objetivo de ahorro, como tu fondo de emergencia.')}</p>}
            </div>
          </Card>
          <Card delay={0.38}>
            <CardHeader title={tr('Alertas')} subtitle={al.length ? undefined : tr('Todo en orden')} />
            <div className="p-2">
              {al.map((a) => <AlertRow key={a.key} a={a} onDismiss={() => mutate((e) => dismissAlert(e, a.key))} />)}
              {!al.length && <div className="flex items-center gap-3 px-3 py-3"><IconTile name="shield" color="var(--emerald)" size={36} /><p className="text-[12.5px] text-muted">{tr('Sin alertas financieras.')}</p></div>}
            </div>
          </Card>
        </div>
      </div>
      <p className="text-[11px] text-muted text-center pt-2">{tr('Comparación con el periodo anterior ·')}{' '}{formatMoney(p.income, cur)}{' '}{tr('de ingresos y')}{' '}{formatMoney(p.expense, cur)}{' '}{tr('de gastos.')}<Badge className="ml-2 !h-5">{tr('Datos reales')}</Badge></p>
    </div>
  );
}

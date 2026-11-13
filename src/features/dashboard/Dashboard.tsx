import { useState } from 'react';
import { motion } from 'motion/react';
import clsx from 'clsx';
import { useApp } from '../../store/app';
import { useActor, useCan, useProfile, useQuery, useScope } from '../../hooks/useDb';
import { useRange } from '../../hooks/useRange';
import { alerts, balances, expensesByCategory, monthlySeries, totals, upcoming } from '../../db/repo/analytics';
import { getPrefs } from '../../db/repo/core';
import { listAccounts, listTransactions } from '../../db/repo/finance';
import { listGoals } from '../../db/repo/planning';
import { Card, CardHeader, Money, EmptyState, Button, Segmented, useMotionOK } from '../../components/ui';
import { IncomeExpenseBars, CategoryDonut } from '../../components/charts';
import { Icon } from '../../icons';
import { combined, pct } from '../../lib/money';
import { daysInMonth, diffDays, formatDate, today } from '../../lib/dates';
import { buildStories, dailyAllowance, type StoryRoute } from '../../domain/overview';
import { savingsRate } from '../../domain/insights';
import { lang, tr } from '../../lib/i18n';

export type DashboardStyle = 'today' | 'stories' | 'calm';

function useDashData() {
  const profile = useProfile();
  const actor = useActor();
  const sf = useScope();
  const { range, prev, label } = useRange();
  const cur = profile.primaryCurrency;
  const visibleTo = profile.mode === 'individual' ? undefined : sf.scope === 'personal' ? actor.id : undefined;
  const t = useQuery((e) => totals(e, range, sf), [range, sf]);
  const bal = useQuery((e) => balances(e, visibleTo, profile.mode !== 'individual' && sf.scope === 'family'), [visibleTo, sf.scope]);
  const series = useQuery((e) => monthlySeries(e, 6, sf), [sf]);
  const cats = useQuery((e) => expensesByCategory(e, range, sf), [range, sf]);
  const prevCats = useQuery((e) => expensesByCategory(e, prev, sf), [prev, sf]);
  const bills = useQuery((e) => upcoming(e, sf, 30).filter((u) => u.kind !== 'income'), [sf]);
  const goals = useQuery((e) => listGoals(e, sf).filter((g) => !g.completedAt), [sf]);
  const al = useQuery((e) => alerts(e, sf), [sf]);
  const hasTx = useQuery((e) => listTransactions(e, { scope: sf, limit: 1 }).length > 0, [sf]);
  const hasAccounts = useQuery((e) => listAccounts(e).length > 0);
  return { cur, sf, label, t, bal, series, cats, prevCats, bills, goals, al, hasTx, hasAccounts, available: combined(bal.available, cur) };
}
type Data = ReturnType<typeof useDashData>;

function QuickActions() {
  const openTx = useApp((s) => s.openTx);
  const go = useApp((s) => s.go);
  if (!useCan('tx.create')) return null;
  const items: Array<[string, string, () => void]> = [
    ['arrowDownLeft', tr('Gasto'), () => openTx('expense')], ['arrowUpRight', tr('Ingreso'), () => openTx('income')],
    ['transfer', tr('Transferir'), () => openTx('transfer')], ['savings', tr('Plan mensual'), () => go('plan')],
  ];
  return (
    <div className="flex flex-wrap gap-2" data-tour="quick">
      {items.map(([icon, label, onClick]) => (
        <button key={label} onClick={onClick} className="inline-flex items-center gap-2.5 h-11 pl-1.5 pr-4 rounded-full bg-surface border border-line/70 text-[13px] font-medium text-ink hover:border-brand/40 hover:bg-brand-soft/40 transition active:scale-[0.97]">
          <span className="grid place-items-center size-8 rounded-full bg-brand-soft text-brand"><Icon name={icon} size={16} strokeWidth={2} /></span>{label}
        </button>
      ))}
    </div>
  );
}

/** The one chart, with a switch instead of several charts at once. */
function ChartCard({ d, delay = 0 }: { d: Data; delay?: number }) {
  const [view, setView] = useState<'flow' | 'cats'>('flow');
  return (
    <Card delay={delay} hover={false}>
      <CardHeader title={view === 'flow' ? tr('Ingresos y gastos') : tr('Distribución de gastos')} subtitle={view === 'flow' ? tr('Últimos 6 meses') : d.label}
        action={<Segmented size="sm" layoutId="dash-chart" value={view} onChange={setView} options={[{ value: 'flow', label: tr('Meses') }, { value: 'cats', label: tr('Categorías') }]} />} />
      {view === 'flow' ? (
        <div className="px-3 pb-3">{d.series.some((s) => s.income || s.expense) ? <IncomeExpenseBars data={d.series} currency={d.cur} /> : <EmptyState icon="reports" title={tr('Aún no hay datos')} body={tr('Registra ingresos y gastos para ver tu evolución.')} />}</div>
      ) : d.cats.length ? (
        <div className="flex flex-wrap items-center gap-6 p-5 pt-3">
          <CategoryDonut data={d.cats.slice(0, 7)} currency={d.cur} size={180} />
          <ul className="flex-1 min-w-[200px] space-y-2">
            {d.cats.slice(0, 5).map((c) => (
              <li key={c.categoryId} className="flex items-center gap-2 text-[12.5px]">
                <span className="size-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                <span className="truncate text-ink-2">{c.name}</span>
                <span className="ml-auto text-muted num">{pct(c.amount, d.t.expense || 1).toFixed(0)}%</span>
                <Money cents={c.amount} currency={d.cur} compact className="w-20 text-right font-semibold" />
              </li>
            ))}
          </ul>
        </div>
      ) : <EmptyState icon="budget" title={tr('Sin gastos en este periodo')} body={tr('Cuando registres gastos verás aquí su distribución por categoría.')} />}
    </Card>
  );
}

function PendingCard({ d, delay = 0 }: { d: Data; delay?: number }) {
  const go = useApp((s) => s.go);
  return (
    <Card delay={delay} hover={false}>
      <CardHeader title={tr('Pendientes')} subtitle={tr('Pagos de los próximos 30 días')} action={<Button variant="ghost" size="sm" onClick={() => go('calendar')}>{tr('Ver todos')}</Button>} />
      <ul className="p-2">
        {d.bills.slice(0, 5).map((n, i) => (
          <li key={i} className="flex items-center gap-3 px-3 py-2.5">
            <div className="w-10 text-center"><p className="text-[16px] font-semibold leading-none num">{n.date.slice(8)}</p><p className="text-[10px] text-muted uppercase">{formatDate(n.date, 'day').split(' ')[1]}</p></div>
            <p className="flex-1 text-[13px] text-ink truncate">{n.title}</p>
            <Money cents={n.amount} currency={n.currency} className="text-[13px] font-semibold" />
          </li>
        ))}
        {!d.bills.length && <p className="px-3 py-4 text-[12.5px] text-muted">{tr('No tienes pagos programados. ¡Todo tranquilo!')}</p>}
      </ul>
    </Card>
  );
}

// ------------------------------------------------------------------ Capas tranquilas
function CalmView({ d }: { d: Data }) {
  const left = d.t.income - d.t.expense;
  const period = lang === 'es' ? d.label.toLowerCase() : d.label;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-tour="hero">
        {([[tr('Saldo disponible'), d.available, false], [tr('Gastado en {period}', { period }), d.t.expense, false], [tr('Te queda en {period}', { period }), left, true]] as const).map(([l, v, sign], i) => (
          <Card key={i} delay={i * 0.05} hover={false} className={clsx('p-5', i === 0 && 'hero-surface text-white border-transparent')}>
            <p className={clsx('text-[12.5px]', i === 0 ? 'text-white/75' : 'text-muted')}>{l}</p>
            <Money animated cents={v} currency={d.cur} sign={sign} className={clsx('block text-[28px] font-semibold tracking-[-0.045em] mt-2', sign && v < 0 && 'text-coral')} />
          </Card>
        ))}
      </div>
      <QuickActions />
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 xl:col-span-8"><ChartCard d={d} delay={0.1} /></div>
        <div className="col-span-12 xl:col-span-4"><PendingCard d={d} delay={0.15} /></div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Hoy
function TodayView({ d }: { d: Data }) {
  const ok = useMotionOK();
  const [more, setMore] = useState(false);
  const now = today();
  const daysLeft = daysInMonth(Number(now.slice(0, 4)), Number(now.slice(5, 7)) - 1) - Number(now.slice(8)) + 1;
  const due = d.bills.filter((b) => b.date.slice(0, 7) === now.slice(0, 7)).reduce((a, b) => a + b.amount, 0);
  const perDay = dailyAllowance(d.available, due, daysLeft);
  const bill = d.bills[0];
  const rate = savingsRate(d.t.income, d.t.expense);
  return (
    <div className="max-w-[760px] mx-auto space-y-5">
      <motion.section data-tour="hero" initial={ok ? { opacity: 0, y: 14 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="rounded-[28px] hero-surface text-white px-8 py-10 text-center shadow-pop">
        <p className="text-[14px] text-white/80">{tr('Puedes gastar hoy')}</p>
        <Money animated cents={perDay} currency={d.cur} className="block text-[56px] font-semibold tracking-[-0.05em] leading-tight mt-1" />
        <p className="text-[13px] text-white/75 mt-2 max-w-[440px] mx-auto">{tr('Tu saldo menos los pagos que faltan este mes, repartido entre los {n} días que quedan.', { n: daysLeft })}</p>
        <p className="text-[12.5px] text-white/70 mt-4">{tr('Saldo disponible')}{' '}<Money cents={d.available} currency={d.cur} className="text-white font-semibold" /></p>
      </motion.section>
      <div className="flex flex-wrap justify-center gap-2">
        {bill && <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-amber-soft text-[12.5px] text-ink"><Icon name="calendar" size={14} className="text-amber" />{tr('{title} vence en {n} días', { title: bill.title, n: Math.max(0, diffDays(bill.date, now)) })}</span>}
        {d.t.income > 0 && <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-emerald-soft text-[12.5px] text-ink"><Icon name="savings" size={14} className="text-emerald" />{tr('Ahorras el {pct} %', { pct: rate.toFixed(0) })}</span>}
        {d.al.length > 0 && <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-coral-soft text-[12.5px] text-ink"><Icon name="alert" size={14} className="text-coral" />{tr('{n} aviso(s)', { n: d.al.length })}</span>}
      </div>
      <div className="flex justify-center"><QuickActions /></div>
      <div className="flex justify-center">
        <Button variant="ghost" size="sm" onClick={() => setMore(!more)} aria-expanded={more}>{more ? tr('Ocultar detalle') : tr('Ver detalle')}<Icon name="chevronDown" size={15} className={clsx('transition-transform', more && 'rotate-180')} /></Button>
      </div>
      {more && <div className="space-y-5"><ChartCard d={d} /><PendingCard d={d} /></div>}
    </div>
  );
}

// ------------------------------------------------------------------ Historias
const TONE = { good: ['sparkle', 'bg-emerald-soft text-emerald'], warn: ['alert', 'bg-amber-soft text-amber'], info: ['info', 'bg-brand-soft text-brand'] } as const;

function StoriesView({ d }: { d: Data }) {
  const go = useApp((s) => s.go);
  const openTx = useApp((s) => s.openTx);
  const now = today();
  const stories = buildStories({
    currency: d.cur, income: d.t.income, expense: d.t.expense, cats: d.cats, prevCats: d.prevCats,
    bills: d.bills.map((b) => ({ title: b.title, amount: b.amount, currency: b.currency, inDays: diffDays(b.date, now) })),
    goals: d.goals, alerts: d.al, hasTransactions: d.hasTx,
  });
  const act = (to: StoryRoute) => (to === 'newTx' ? openTx() : go(to));
  return (
    <div className="max-w-[680px] mx-auto space-y-4">
      <Card hover={false} className="p-5 flex items-center justify-between gap-4" >
        <div data-tour="hero">
          <p className="text-[12.5px] text-muted">{tr('Saldo disponible')}</p>
          <Money animated cents={d.available} currency={d.cur} className="block text-[30px] font-semibold tracking-[-0.045em]" />
        </div>
        <Icon name="bank" size={28} className="text-brand" />
      </Card>
      <QuickActions />
      <ul className="space-y-3" aria-label={tr('Lo importante de hoy')}>
        {stories.map((s, i) => (
          <motion.li key={s.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
            className="flex items-start gap-4 rounded-[22px] bg-surface border border-line/70 p-5">
            <span className={clsx('grid place-items-center size-10 shrink-0 rounded-full', TONE[s.tone][1])}><Icon name={TONE[s.tone][0]} size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] text-ink leading-snug">{s.text}</p>
              <button onClick={() => act(s.action.to)} className="mt-2 text-[13px] font-medium text-brand hover:underline">{s.action.label}</button>
            </div>
          </motion.li>
        ))}
        {!stories.length && <li className="rounded-[22px] bg-surface border border-line/70 p-5 text-[14px] text-ink-2">{tr('Todo en orden por ahora. Vuelve cuando registres más movimientos.')}</li>}
      </ul>
    </div>
  );
}

export default function Dashboard() {
  const go = useApp((s) => s.go);
  const style = useQuery((e) => getPrefs(e).dashboardStyle ?? 'calm');
  const d = useDashData();
  if (!d.hasAccounts) {
    return <Card className="mt-6"><EmptyState icon="bank" title={tr('Crea tu primera cuenta')} body={tr('Añade una cuenta bancaria, efectivo o tarjeta para empezar a registrar movimientos.')} action={<Button icon="plus" onClick={() => go('accounts')}>{tr('Añadir cuenta')}</Button>} /></Card>;
  }
  return style === 'today' ? <TodayView d={d} /> : style === 'stories' ? <StoriesView d={d} /> : <CalmView d={d} />;
}

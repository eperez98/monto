import { useState } from 'react';
import clsx from 'clsx';
import { Button, Card, Input, Modal, Money, MoneyInput, PageHeader, Segmented, Select, IconButton } from '../../components/ui';
import { useActor, useCan, useMutate, useProfile, useQuery } from '../../hooks/useDb';
import { getExpensePlan, getPlanPaid, listIncomeSources, memberMonthlyIncome, saveExpensePlan, setPlanPaid } from '../../db/repo/planning';
import { listMembers } from '../../db/repo/core';
import { ExpensePlanner } from './ExpensePlanner';
import { paymentOrder, planSummary, type PlanItem } from '../../domain/plan';
import { centsToInput, parseMoney, type Currency } from '../../lib/money';
import { addMonths, formatMonth, monthKey, today } from '../../lib/dates';
import { tr } from '../../lib/i18n';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const JOINT = '__joint__';

/** Payday of a member paid once a month (also hourly workers paid monthly), or null. */
function monthlyPayDay(sources: ReturnType<typeof listIncomeSources>): number | null {
  const c = sources.map((s) => s.config).find((c) => c.frequency === 'monthly' || (c.frequency === 'hourly' && c.schedule === 'monthly'));
  return c ? c.payDay1 ?? 30 : null;
}

export default function Plan() {
  const actor = useActor();
  const profile = useProfile();
  const members = useQuery((e) => listMembers(e));
  const partner = members.find((m) => m.id !== actor.id);
  const couple = profile.mode === 'couple' && !!partner;
  const [chosenMonth, setChosenMonth] = useState<string>();
  const currentMonth = monthKey(today());
  const month = chosenMonth ?? currentMonth;
  const shiftMonth = (offset: number) => setChosenMonth(monthKey(addMonths(`${month}-01`, offset)));
  const [view, setView] = useState<string>(actor.id);
  return (
    <>
      <PageHeader title={tr('Plan mensual')} subtitle={tr('Tus gastos fijos frente a tu ingreso: cuánto te queda y cuánto puedes ahorrar')}
        actions={couple && <Segmented layoutId="plan-member" value={view} onChange={setView}
          options={[{ value: actor.id, label: tr('Mi plan') }, { value: partner.id, label: tr('Plan de {name}', { name: partner.name.split(' ')[0] }) }, { value: JOINT, label: tr('En conjunto') }]} />} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-2xl border border-line bg-surface px-1">
          <IconButton icon="chevronLeft" label={tr('Mes anterior')} onClick={() => shiftMonth(-1)} />
          <h2 aria-live="polite" className="min-w-32 px-2 text-center text-sm font-semibold text-ink">{formatMonth(month)}</h2>
          <IconButton icon="chevronRight" label={tr('Mes siguiente')} onClick={() => shiftMonth(1)} />
        </div>
        {month !== currentMonth && <Button size="sm" variant="ghost" onClick={() => setChosenMonth(undefined)}>{tr('Volver al mes actual')}</Button>}
      </div>
      {view === JOINT && couple
        ? <JointPlan month={month} memberIds={members.map((m) => m.id)} names={Object.fromEntries(members.map((m) => [m.id, m.name.split(' ')[0]]))} currency={profile.primaryCurrency} />
        : <MemberPlan key={`${view}:${month}`} month={month} memberId={couple ? view : actor.id} currency={profile.primaryCurrency} />}
    </>
  );
}

/** One member's plan: the result on top and one editable tile per bill, in the order to pay them. */
function MemberPlan({ memberId, month, currency: cur }: { memberId: string; month: string; currency: Currency }) {
  const actor = useActor();
  const mutate = useMutate();
  const own = memberId === actor.id;
  const canIncome = useCan('income.manage');
  const canMembers = useCan('member.manage');
  const canEdit = own ? canIncome : canMembers;
  const saved = useQuery((e) => getExpensePlan(e, memberId, month), [memberId, month]);
  const income = useQuery((e) => memberMonthlyIncome(e, memberId), [memberId]);
  const payDay = useQuery((e) => monthlyPayDay(listIncomeSources(e, memberId)), [memberId]);
  const paid = useQuery((e) => getPlanPaid(e, memberId, month), [memberId, month]);
  const [wizard, setWizard] = useState(false);
  const [adding, setAdding] = useState<{ name: string; amount: string } | null>(null);

  const store = (items: PlanItem[], msg?: string) => (canEdit ? mutate((e, a) => saveExpensePlan(e, a, items, memberId, month), msg) : undefined);
  const patch = (name: string, p: Partial<PlanItem>, msg?: string) => store(saved.map((i) => (i.name === name ? { ...i, ...p } : i)), msg);
  const markPaid = (item: PlanItem, isPaid: boolean, deduct: boolean) => mutate((e, a) => setPlanPaid(e, a, { name: item.name, amount: item.amount, kind: item.kind }, { paid: isPaid, deduct, memberId, month }),
    !isPaid ? tr('Marcado como pendiente') : deduct ? tr('Pago registrado y descontado del saldo') : tr('Marcado como pagado'));

  if (!saved.length && !canEdit) return <p className="text-sm text-muted">{tr('Sin gastos planificados para este mes.')}</p>;

  if (!saved.length) {
    return (
      <Card hover={false} className="p-6 max-w-[760px]">
        <ExpensePlanner key={memberId} income={income} currency={cur} initial={[]} onFinish={(items) => { store(items, tr('Plan mensual guardado')); }} />
      </Card>
    );
  }

  const steps = paymentOrder(income, payDay ?? 1, saved);
  const sum = planSummary(income, saved);
  const paidCount = steps.filter((s) => paid[s.name]?.paid).length;
  const pending = steps.filter((s) => !paid[s.name]?.paid).reduce((a, s) => a + s.amount, 0);
  const add = () => {
    if (!adding) return;
    const v = parseMoney(adding.amount || '0');
    const name = adding.name.trim();
    if (!name || Number.isNaN(v) || v <= 0) return;
    if (store([...saved.filter((i) => i.name !== name), { name, amount: v }], tr('Gasto agregado')) !== undefined) setAdding(null);
  };

  const renderBill = (s: (typeof steps)[number], k: number) => {
    const st = paid[s.name];
    return (
      <li key={s.name} className={clsx('card rounded-[22px] border bg-surface p-4 flex flex-col gap-3', st?.paid ? 'border-emerald/40' : 'border-line/70')}>
        <div className="flex items-start gap-2.5">
          <span className={clsx('grid place-items-center size-7 shrink-0 rounded-full text-[12px] font-semibold num', st?.paid ? 'bg-emerald-soft text-emerald' : 'bg-brand-soft text-brand')}>{st?.paid ? '✓' : k + 1}</span>
          <span className="min-w-0 flex-1">
            <span className={clsx('block text-[13.5px] font-semibold truncate', st?.paid ? 'text-muted line-through' : 'text-ink')} title={s.name}>{s.name}</span>
            <span className={clsx('block text-[11.5px]', s.short ? 'text-coral' : 'text-muted')}>{s.short ? tr('No alcanza: faltan') : tr('Quedan')}{' '}<Money cents={Math.abs(s.balanceAfter)} currency={cur} /></span>
          </span>
          {canEdit && <IconButton icon="trash" label={tr('Quitar {name}', { name: s.name })} size={30} onClick={() => store(saved.filter((i) => i.name !== s.name), tr('Gasto quitado'))} />}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <AmountField key={s.amount} cents={s.amount} currency={cur} disabled={!canEdit} label={tr('Monto de {name}', { name: s.name })} onCommit={(v) => patch(s.name, { amount: v }, tr('Monto actualizado'))} />
          <Select aria-label={tr('Vence el día')} value={s.dueDay ?? ''} disabled={!canEdit} onChange={(e) => patch(s.name, { dueDay: e.target.value ? Number(e.target.value) : undefined }, tr('Fecha de pago guardada'))} className="!h-10 !text-[12.5px]">
            <option value="">{payDay ? tr('Al cobrar') : tr('Sin fecha')}</option>
            {DAYS.map((d) => <option key={d} value={d}>{tr('Día {d}', { d })}</option>)}
          </Select>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-2">
            <label className="inline-flex items-center gap-2 cursor-pointer"><input type="checkbox" className="size-4 accent-brand" checked={!!st?.paid} onChange={(e) => markPaid(s, e.target.checked, false)} />{tr('Pagado')}</label>
            {st?.paid && <label className="inline-flex items-center gap-2 cursor-pointer"><input type="checkbox" role="switch" className="size-4 accent-brand" checked={!!st.txId} onChange={(e) => markPaid(s, true, e.target.checked)} />{tr('Descontar del saldo actual')}</label>}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-5">
      <PlanResult income={income} expenses={sum.expenses} remaining={sum.remaining} canSave={sum.canSave} rate={sum.savingsRate} currency={cur}
        line={<>{tr('Pagados {n} de {total} · Pendiente', { n: paidCount, total: steps.length })}{' '}<Money cents={pending} currency={cur} className="font-semibold" /></>}
        note={payDay ? tr('Cobras una vez al mes, el día {d}. Paga en este orden:', { d: payDay }) : tr('Ordenados por fecha de vencimiento.')} />
      <div>
        <h2 className="text-sm font-semibold">{tr('Gastos pendientes')}</h2>
        {canEdit && <p className="mt-1 text-xs text-muted">{tr('Los cambios se guardan solo para el mes seleccionado.')}</p>}
      </div>
      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4" aria-label={tr('Gastos pendientes')}>
        {steps.filter((s) => !paid[s.name]?.paid).map(renderBill)}
        {canEdit && (
          <li className="card rounded-[22px] border border-dashed border-line p-4 flex flex-col justify-center gap-2">
            {adding ? (
              <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
                <Input autoFocus value={adding.name} placeholder={tr('Nombre del gasto')} onChange={(e) => setAdding({ ...adding, name: e.target.value })} aria-label={tr('Nombre del gasto')} />
                <MoneyInput currency={cur} value={adding.amount} onChange={(v) => setAdding({ ...adding, amount: v })} aria-label={tr('Monto del gasto nuevo')} />
                <div className="flex gap-2"><Button type="submit" size="sm">{tr('Agregar')}</Button><Button type="button" size="sm" variant="ghost" onClick={() => setAdding(null)}>{tr('Cancelar')}</Button></div>
              </form>
            ) : (
              <>
                <Button variant="ghost" icon="plus" onClick={() => setAdding({ name: '', amount: '' })}>{tr('Agregar gasto')}</Button>
                <Button variant="ghost" size="sm" icon="edit" onClick={() => setWizard(true)}>{tr('Preguntar uno por uno')}</Button>
              </>
            )}
          </li>
        )}
      </ol>
      {paidCount > 0 && (
        <details className="rounded-2xl border border-line bg-surface p-4">
          <summary className="cursor-pointer text-sm font-semibold">{tr('Gastos pagados ({n})', { n: paidCount })}</summary>
          <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
            {steps.filter((s) => paid[s.name]?.paid).map(renderBill)}
          </ul>
        </details>
      )}
      <Modal open={wizard} onClose={() => setWizard(false)} title={tr('Revisar gastos uno por uno')} icon="savings" width={760}>
        <ExpensePlanner key={String(wizard)} income={income} currency={cur} initial={saved} onFinish={(items) => { store(items, tr('Plan mensual guardado')); setWizard(false); }} />
      </Modal>
    </div>
  );
}

/** Amount input that saves when it loses focus (not on every keystroke). */
function AmountField({ cents, currency, disabled, label, onCommit }: { cents: number; currency: Currency; disabled: boolean; label: string; onCommit: (v: number) => void }) {
  const [value, setValue] = useState(centsToInput(cents));
  const commit = () => { const v = parseMoney(value || '0'); if (!Number.isNaN(v) && v > 0 && v !== cents) onCommit(v); else setValue(centsToInput(cents)); };
  if (disabled) return <Money cents={cents} currency={currency} className="self-center text-[18px] font-semibold" />;
  return (
    <span onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}>
      <MoneyInput currency={currency} value={value} onChange={setValue} aria-label={label} />
    </span>
  );
}

/** Both partners' plans added up (read-only); each tile says whose bill it is. */
function JointPlan({ memberIds, names, month, currency: cur }: { month: string; memberIds: string[]; names: Record<string, string>; currency: Currency }) {
  const data = useQuery((e) => memberIds.map((id) => ({ id, items: getExpensePlan(e, id, month), income: memberMonthlyIncome(e, id) })), [memberIds.join(), month]);
  const income = data.reduce((a, d) => a + d.income, 0);
  const items = data.flatMap((d) => d.items.map((i) => ({ ...i, owner: d.id }))).sort((a, b) => (a.dueDay ?? 0) - (b.dueDay ?? 0));
  const sum = planSummary(income, items);
  return (
    <div className="space-y-5">
      <PlanResult income={income} expenses={sum.expenses} remaining={sum.remaining} canSave={sum.canSave} rate={sum.savingsRate} currency={cur} note={tr('Los ingresos y gastos de los dos, sumados. Para editar, abre el plan de cada uno.')} />
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4" aria-label={tr('Gastos de los dos')}>
        {items.map((i) => (
          <li key={`${i.owner}:${i.name}`} className="card rounded-[22px] border border-line/70 bg-surface p-4">
            <div className="flex items-center justify-between gap-2"><span className="text-[13.5px] font-semibold truncate">{i.name}</span><span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] text-brand">{names[i.owner]}</span></div>
            <div className="mt-2 flex items-end justify-between"><span className="text-[11.5px] text-muted">{i.dueDay ? tr('Día {d}', { d: i.dueDay }) : tr('Sin fecha')}</span><Money cents={i.amount} currency={cur} className="text-[18px] font-semibold" /></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlanResult({ income, expenses, remaining, canSave, rate, currency, line, note }: { income: number; expenses: number; remaining: number; canSave: number; rate: number; currency: Currency; line?: React.ReactNode; note: string }) {
  return (
    <section className="card rounded-[28px] hero-surface text-white p-6 md:p-7 shadow-pop">
      <p className="text-[12.5px] text-white/70">{tr('Resultado del mes')}</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-3">
        <div><p className="text-[11.5px] text-white/60">{tr('Ingreso mensual neto')}</p><Money animated cents={income} currency={currency} className="block text-[22px] font-semibold" /></div>
        <div><p className="text-[11.5px] text-white/60">{tr('Gastos mensuales')}</p><Money animated cents={expenses} currency={currency} className="block text-[22px] font-semibold" /></div>
        <div className="col-span-2 lg:col-span-1 order-first lg:order-none"><p className="text-[11.5px] text-white/60">{tr('Fondo restante')}</p><Money animated cents={remaining} currency={currency} className={clsx('block text-[30px] font-semibold tracking-[-0.04em]', remaining < 0 && 'text-[#FFC2CC]')} /></div>
        <div><p className="text-[11.5px] text-white/60">{tr('Puedes ahorrar')}</p><p className="text-[22px] font-semibold num">{Math.round(rate)}%</p></div>
      </div>
      <p className="text-[13px] text-white/85 mt-4">
        {remaining >= 0
          ? <>{tr('Después de pagar todo te quedan')}{' '}<Money cents={canSave} currency={currency} className="font-semibold" />{tr(' para ahorrar.')}</>
          : <>{tr('Tu salario no cubre todos los gastos: faltan')}{' '}<Money cents={-remaining} currency={currency} className="font-semibold" />.</>}
      </p>
      <div className="mt-3 pt-3 border-t border-white/15 flex flex-wrap justify-between gap-2 text-[12px] text-white/75"><span>{note}</span>{line && <span>{line}</span>}</div>
    </section>
  );
}

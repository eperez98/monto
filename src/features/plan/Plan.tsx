import { useCallback } from 'react';
import clsx from 'clsx';
import { Card, CardHeader, Money, PageHeader, Select } from '../../components/ui';
import { useActor, useCan, useMutate, useProfile, useQuery } from '../../hooks/useDb';
import { getExpensePlan, getPlanPaid, listIncomeSources, memberMonthlyIncome, saveExpensePlan, setPlanPaid } from '../../db/repo/planning';
import { useApp } from '../../store/app';
import { ExpensePlanner } from './ExpensePlanner';
import { paymentOrder, planSummary, type PlanItem } from '../../domain/plan';
import { tr } from '../../lib/i18n';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export default function Plan() {
  const actor = useActor();
  const profile = useProfile();
  const canEdit = useCan('income.manage');
  const mutate = useMutate();
  const go = useApp((s) => s.go);
  const cur = profile.primaryCurrency;
  const saved = useQuery((e) => getExpensePlan(e, actor.id), [actor.id]);
  const income = useQuery((e) => memberMonthlyIncome(e, actor.id), [actor.id]);
  // Monthly earners (also hourly workers paid monthly) get a pay-order plan from their payday.
  const payDay = useQuery((e) => {
    const c = listIncomeSources(e, actor.id).map((s) => s.config).find((c) => c.frequency === 'monthly' || (c.frequency === 'hourly' && c.schedule === 'monthly'));
    return c ? c.payDay1 ?? 30 : null;
  }, [actor.id]);
  const store = useCallback((items: PlanItem[], msg: string) => { if (canEdit) mutate((e, a) => saveExpensePlan(e, a, items), msg); }, [canEdit, mutate]);
  const save = useCallback((items: PlanItem[]) => store(items, tr('Plan mensual guardado')), [store]);
  const setDue = (name: string, v: string) => store(saved.map((i) => (i.name === name ? { ...i, dueDay: v ? Number(v) : undefined } : i)), tr('Fecha de pago guardada'));

  const paidState = useQuery((e) => getPlanPaid(e, actor.id), [actor.id]);
  // Everyone gets the month's bills by due date; monthly earners see them counted from payday.
  const steps = paymentOrder(income, payDay ?? 1, saved);
  const left = planSummary(income, saved).remaining;
  const paidCount = steps.filter((s) => paidState[s.name]?.paid).length;
  const pending = steps.filter((s) => !paidState[s.name]?.paid).reduce((a, s) => a + s.amount, 0);
  const markPaid = (item: PlanItem, paid: boolean, deduct: boolean) => mutate((e, a) => setPlanPaid(e, a, { name: item.name, amount: item.amount, kind: item.kind }, { paid, deduct }),
    !paid ? tr('Marcado como pendiente') : deduct ? tr('Pago registrado y descontado del saldo') : tr('Marcado como pagado'));

  return (
    <>
      <PageHeader title={tr('Plan mensual')} subtitle={tr('Tus gastos fijos frente a tu ingreso: cuánto te queda y cuánto puedes ahorrar')} />
      <div className="flex flex-wrap items-start gap-5">
        <Card hover={false} className="p-6 w-full max-w-[760px]">
          <ExpensePlanner key={actor.id} income={income} currency={cur} initial={saved} startAtSummary={saved.length > 0} onFinish={save} />
        </Card>
        <Card hover={false} className="w-full max-w-[560px]" >
          <CardHeader title={payDay ? tr('Orden de pagos') : tr('Gastos del mes')}
            subtitle={payDay ? tr('Cobras una vez al mes, el día {d}. Paga en este orden:', { d: payDay }) : tr('Ordenados por fecha de vencimiento.')} />
          {!steps.length ? (
            <p className="p-5 pt-3 text-[13px] text-ink-2">{tr('Completa tu plan mensual para generar el orden de pagos.')}</p>
          ) : (
            <div className="p-3">
              <p className="px-2 pb-2 text-[12px] text-muted">{tr('Marca lo que ya pagaste este mes. Activa «Descontar del saldo» solo si el pago aún no estaba reflejado en tu saldo actual.')}</p>
              <p className="px-2 pb-3 text-[12.5px] text-ink-2">{tr('Pagados {n} de {total} · Pendiente', { n: paidCount, total: steps.length })}{' '}<Money cents={pending} currency={cur} className="font-semibold" /></p>
              <ol className="space-y-1" aria-label={tr('Gastos del mes')}>
                {steps.map((s, k) => {
                  const st = paidState[s.name];
                  return (
                    <li key={s.name} className="rounded-[16px] px-2 py-2 hover:bg-surface-2">
                      <div className="flex items-center gap-3">
                        <span className={clsx('grid place-items-center size-7 shrink-0 rounded-full text-[12px] font-semibold num', st?.paid ? 'bg-emerald-soft text-emerald' : 'bg-brand-soft text-brand')}>{st?.paid ? '✓' : k + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className={clsx('block text-[13px] font-medium truncate', st?.paid ? 'text-muted line-through' : 'text-ink')}>{s.name}</span>
                          <span className={clsx('block text-[11.5px]', s.short ? 'text-coral' : 'text-muted')}>{s.short ? tr('No alcanza: faltan') : tr('Quedan')}{' '}<Money cents={Math.abs(s.balanceAfter)} currency={cur} /></span>
                        </span>
                        <Select aria-label={tr('Vence el día')} value={s.dueDay ?? ''} disabled={!canEdit} onChange={(e) => setDue(s.name, e.target.value)} className="!w-[112px] !h-8 !text-[12px]">
                          <option value="">{payDay ? tr('Al cobrar') : tr('Sin fecha')}</option>
                          {DAYS.map((d) => <option key={d} value={d}>{tr('Día {d}', { d })}</option>)}
                        </Select>
                        <Money cents={s.amount} currency={cur} className="w-20 text-right text-[13px] font-semibold" />
                      </div>
                      {canEdit && (
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pl-10 mt-1.5 text-[12px] text-ink-2">
                          <label className="inline-flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="size-4 accent-brand" checked={!!st?.paid} onChange={(e) => markPaid(s, e.target.checked, false)} />{tr('Pagado')}
                          </label>
                          {st?.paid && (
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" role="switch" className="size-4 accent-brand" checked={!!st.txId} onChange={(e) => markPaid(s, true, e.target.checked)} />{tr('Descontar del saldo actual')}
                            </label>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
              <div className={clsx('mt-2 rounded-[16px] px-4 py-3 text-[13px]', left >= 0 ? 'bg-emerald-soft text-ink' : 'bg-coral-soft text-ink')}>
                {left >= 0
                  ? <>{tr('Después de pagar todo te quedan')}{' '}<Money cents={left} currency={cur} className="font-semibold" />{tr(' para ahorrar.')}</>
                  : <>{tr('Tu salario no cubre todos los gastos: faltan')}{' '}<Money cents={-left} currency={cur} className="font-semibold" />.</>}
              </div>
              {!payDay && (
                <p className="px-2 pt-3 text-[12px] text-muted">{tr('¿Cobras una vez al mes? Márcalo como «Mensual» en')}{' '}<button className="text-brand hover:underline" onClick={() => go('income')}>{tr('Ingresos y salario')}</button>{' '}{tr('y el orden empezará desde tu día de cobro.')}</p>
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

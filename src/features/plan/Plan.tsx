import { useCallback } from 'react';
import clsx from 'clsx';
import { Button, Card, CardHeader, Money, PageHeader, Select } from '../../components/ui';
import { useActor, useCan, useMutate, useProfile, useQuery } from '../../hooks/useDb';
import { getExpensePlan, listIncomeSources, memberMonthlyIncome, saveExpensePlan } from '../../db/repo/planning';
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
  // Re-running the questionnaire keeps the due days already set for each bill.
  const save = useCallback((items: PlanItem[]) => store(items.map((i) => ({ ...i, dueDay: saved.find((s) => s.name === i.name)?.dueDay })), tr('Plan mensual guardado')), [store, saved]);
  const setDue = (name: string, v: string) => store(saved.map((i) => (i.name === name ? { ...i, dueDay: v ? Number(v) : undefined } : i)), tr('Fecha de pago guardada'));

  const steps = payDay ? paymentOrder(income, payDay, saved) : [];
  const left = planSummary(income, saved).remaining;

  return (
    <>
      <PageHeader title={tr('Plan mensual')} subtitle={tr('Tus gastos fijos frente a tu ingreso: cuánto te queda y cuánto puedes ahorrar')} />
      <div className="flex flex-wrap items-start gap-5">
        <Card hover={false} className="p-6 w-full max-w-[760px]">
          <ExpensePlanner key={actor.id} income={income} currency={cur} initial={saved} startAtSummary={saved.length > 0} onFinish={save} />
        </Card>
        <Card hover={false} className="w-full max-w-[560px]" >
          <CardHeader title={tr('Orden de pagos')} subtitle={payDay ? tr('Cobras una vez al mes, el día {d}. Paga en este orden:', { d: payDay }) : tr('Para quienes cobran una vez al mes.')} />
          {!payDay ? (
            <div className="p-5 pt-3">
              <p className="text-[13px] text-ink-2">{tr('Si recibes tu salario una vez al mes, márcalo como «Mensual» en Ingresos y salario y aquí verás en qué orden pagar tus gastos y cuánto te queda después de cada pago.')}</p>
              <Button className="mt-4" variant="secondary" icon="salary" onClick={() => go('income')}>{tr('Ir a Ingresos y salario')}</Button>
            </div>
          ) : !steps.length ? (
            <p className="p-5 pt-3 text-[13px] text-ink-2">{tr('Completa tu plan mensual para generar el orden de pagos.')}</p>
          ) : (
            <div className="p-3">
              <p className="px-2 pb-2 text-[12px] text-muted">{tr('Indica el día en que vence cada gasto; los que no tienen día se pagan al cobrar.')}</p>
              <ol className="space-y-1">
                {steps.map((s, k) => (
                  <li key={s.name} className="flex items-center gap-3 rounded-[16px] px-2 py-2 hover:bg-surface-2">
                    <span className="grid place-items-center size-7 shrink-0 rounded-full bg-brand-soft text-brand text-[12px] font-semibold num">{k + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-ink truncate">{s.name}</span>
                      <span className={clsx('block text-[11.5px]', s.short ? 'text-coral' : 'text-muted')}>{s.short ? tr('No alcanza: faltan') : tr('Quedan')}{' '}<Money cents={Math.abs(s.balanceAfter)} currency={cur} /></span>
                    </span>
                    <Select aria-label={tr('Vence el día')} value={s.dueDay ?? ''} disabled={!canEdit} onChange={(e) => setDue(s.name, e.target.value)} className="!w-[118px] !h-8 !text-[12px]">
                      <option value="">{tr('Al cobrar')}</option>
                      {DAYS.map((d) => <option key={d} value={d}>{tr('Día {d}', { d })}</option>)}
                    </Select>
                    <Money cents={s.amount} currency={cur} className="w-24 text-right text-[13px] font-semibold" />
                  </li>
                ))}
              </ol>
              <div className={clsx('mt-2 rounded-[16px] px-4 py-3 text-[13px]', left >= 0 ? 'bg-emerald-soft text-ink' : 'bg-coral-soft text-ink')}>
                {left >= 0
                  ? <>{tr('Después de pagar todo te quedan')}{' '}<Money cents={left} currency={cur} className="font-semibold" />{tr(' para ahorrar.')}</>
                  : <>{tr('Tu salario no cubre todos los gastos: faltan')}{' '}<Money cents={-left} currency={cur} className="font-semibold" />.</>}
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

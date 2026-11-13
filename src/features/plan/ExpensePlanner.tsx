import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button, Field, Input, Money, MoneyInput, Progress, EstimateTag, Select } from '../../components/ui';
import { Icon } from '../../icons';
import { planSummary, type PlanItem } from '../../domain/plan';
import { centsToInput, parseMoney, type Currency } from '../../lib/money';
import { tr } from '../../lib/i18n';

/** Common monthly expenses, asked one at a time. `bill`: also ask the day the bill arrives. */
const QUESTIONS: Array<{ name: string; icon: string; hint: string; bill?: boolean }> = [
  { name: tr('Vivienda (alquiler o hipoteca)'), icon: 'home', hint: tr('Lo que pagas cada mes por tu casa o apartamento.'), bill: true },
  { name: tr('Electricidad'), icon: 'utilities', hint: tr('Tu factura de luz promedio.'), bill: true },
  { name: tr('Agua'), icon: 'utilities', hint: tr('Tu factura de agua promedio.'), bill: true },
  { name: tr('Gas'), icon: 'utilities', hint: tr('Cilindros o servicio de gas.'), bill: true },
  { name: tr('Internet y telefonía'), icon: 'internet', hint: tr('Internet, cable y planes de celular.'), bill: true },
  { name: tr('Alimentación'), icon: 'food', hint: tr('Supermercado y comidas fuera de casa.') },
  { name: tr('Transporte'), icon: 'transport', hint: tr('Combustible, Panapass, metro, bus o taxi.') },
  { name: tr('Préstamos'), icon: 'loan', hint: tr('Cuotas de préstamos personales, de auto o hipotecarios.'), bill: true },
  { name: tr('Tarjetas de crédito'), icon: 'card', hint: tr('Lo que pagas al mes en tus tarjetas.'), bill: true },
  { name: tr('Salud y seguros'), icon: 'health', hint: tr('Seguro médico, medicinas y consultas.'), bill: true },
  { name: tr('Educación'), icon: 'education', hint: tr('Colegiaturas, cursos y útiles.'), bill: true },
  { name: tr('Entretenimiento'), icon: 'fun', hint: tr('Salidas, gimnasio y pasatiempos.') },
];
const SUBS = QUESTIONS.length;
const OTHERS = SUBS + 1;
const RESULT = OTHERS + 1;
const MAX_SUBS = 20;
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

type Row = { name: string; amount: string; day?: number };

function DaySelect({ value, onChange, label, empty }: { value?: number; onChange: (d?: number) => void; label: string; empty: string }) {
  return (
    <Select aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}>
      <option value="">{empty}</option>
      {DAYS.map((d) => <option key={d} value={d}>{tr('Día {d}', { d })}</option>)}
    </Select>
  );
}

export function ExpensePlanner({ income, currency, initial, onChange, onFinish, startAtSummary = false }: {
  income: number;
  currency: Currency;
  initial: PlanItem[];
  onChange?: (items: PlanItem[]) => void;
  onFinish?: (items: PlanItem[]) => void;
  startAtSummary?: boolean;
}) {
  const known = new Set(QUESTIONS.map((q) => q.name));
  const toRow = (i: PlanItem): Row => ({ name: i.name, amount: centsToInput(i.amount), day: i.dueDay });
  const [answers, setAnswers] = useState<Record<string, string>>(() => Object.fromEntries(initial.filter((i) => known.has(i.name)).map((i) => [i.name, centsToInput(i.amount)])));
  const [days, setDays] = useState<Record<string, number | undefined>>(() => Object.fromEntries(initial.filter((i) => known.has(i.name)).map((i) => [i.name, i.dueDay])));
  const [subs, setSubs] = useState<Row[]>(() => initial.filter((i) => i.kind === 'subscription').map(toRow));
  const [extras, setExtras] = useState<Row[]>(() => initial.filter((i) => !known.has(i.name) && i.kind !== 'subscription').map(toRow));
  const [step, setStep] = useState(startAtSummary ? RESULT : 0);

  const items = useMemo<PlanItem[]>(() => {
    const cents = (s: string) => { const v = parseMoney(s || '0'); return Number.isNaN(v) ? 0 : Math.max(0, v); };
    const rows = (list: Row[], kind?: 'subscription') => list.filter((x) => x.name.trim()).map((x) => ({ name: x.name.trim(), amount: cents(x.amount), dueDay: x.day, ...(kind ? { kind } : {}) }));
    return [
      ...QUESTIONS.map((q) => ({ name: q.name, amount: cents(answers[q.name] ?? ''), dueDay: q.bill ? days[q.name] : undefined })),
      ...rows(subs, 'subscription'),
      ...rows(extras),
    ].filter((i) => i.amount > 0);
  }, [answers, days, subs, extras]);
  const sum = planSummary(income, items);
  useEffect(() => { onChange?.(items); }, [items, onChange]);

  const go = (n: number) => { setStep(n); if (n === RESULT) onFinish?.(items); };
  const q = QUESTIONS[step];
  const setCount = (n: number) => {
    const c = Math.max(0, Math.min(MAX_SUBS, Math.floor(n) || 0));
    setSubs(c <= subs.length ? subs.slice(0, c) : [...subs, ...Array.from({ length: c - subs.length }, () => ({ name: '', amount: '' }))]);
  };
  const editRow = (list: Row[], set: (r: Row[]) => void, i: number, p: Partial<Row>) => set(list.map((y, j) => (j === i ? { ...y, ...p } : y)));

  return (
    <div>
      <div className="flex items-center justify-between text-[12px] text-muted mb-3">
        <span>{step < SUBS ? tr('Gasto {n} de {total}', { n: step + 1, total: QUESTIONS.length }) : step === SUBS ? tr('Suscripciones') : step === OTHERS ? tr('Otros gastos') : tr('Resultado')}</span>
        <span>{tr('Gastos hasta ahora:')} <Money cents={sum.expenses} currency={currency} className="font-semibold text-ink" /></span>
      </div>
      <Progress value={(Math.min(step, RESULT) / RESULT) * 100} height={4} />
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="mt-6">
          {q && (
            <form onSubmit={(e) => { e.preventDefault(); go(step + 1); }}>
              <div className="flex items-center gap-3"><span className="grid place-items-center size-11 rounded-[14px] bg-surface-2 text-brand"><Icon name={q.icon} size={22} /></span>
                <div><p className="text-[18px] font-semibold tracking-[-0.02em]">{tr('¿Cuánto pagas al mes en {name}?', { name: q.name.toLowerCase() })}</p><p className="text-[12.5px] text-muted">{q.hint}</p></div></div>
              <div className={q.bill ? 'grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-3 mt-5' : 'mt-5'}>
                <Field hint={tr('Déjalo en blanco si no tienes este gasto.')}><MoneyInput autoFocus currency={currency} value={answers[q.name] ?? ''} onChange={(v) => setAnswers({ ...answers, [q.name]: v })} aria-label={q.name} /></Field>
                {q.bill && <Field hint={tr('¿Qué día te llega la factura?')}><DaySelect label={tr('Día de la factura')} empty={tr('No lo sé')} value={days[q.name]} onChange={(d) => setDays({ ...days, [q.name]: d })} /></Field>}
              </div>
              <div className="flex items-center justify-between mt-5">
                {step > 0 ? <Button type="button" variant="ghost" icon="chevronLeft" onClick={() => go(step - 1)}>{tr('Anterior')}</Button> : <span />}
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => { setAnswers({ ...answers, [q.name]: '' }); go(step + 1); }}>{tr('No tengo este gasto')}</Button>
                  <Button type="submit">{tr('Siguiente')}<Icon name="chevronRight" size={16} /></Button>
                </div>
              </div>
            </form>
          )}
          {step === SUBS && (
            <div>
              <div className="flex items-center gap-3"><span className="grid place-items-center size-11 rounded-[14px] bg-surface-2 text-brand"><Icon name="repeat" size={22} /></span>
                <div><p className="text-[18px] font-semibold tracking-[-0.02em]">{tr('¿Cuántas suscripciones tienes?')}</p><p className="text-[12.5px] text-muted">{tr('Streaming, música, apps, nube, gimnasio… Escribe 0 si no tienes.')}</p></div></div>
              <Field className="mt-5 max-w-[160px]"><Input type="number" inputMode="numeric" min={0} max={MAX_SUBS} value={String(subs.length)} onChange={(e) => setCount(Number(e.target.value))} aria-label={tr('Número de suscripciones')} /></Field>
              {subs.length > 0 && (
                <div className="space-y-2 mt-4">
                  <div className="hidden sm:grid grid-cols-[1fr_150px_150px] gap-2 text-[11.5px] text-muted px-1"><span>{tr('Nombre')}</span><span>{tr('Monto al mes')}</span><span>{tr('Día de cobro')}</span></div>
                  {subs.map((x, i) => (
                    <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_150px_150px] gap-2">
                      <Input value={x.name} placeholder={tr('Ej. Netflix')} aria-label={tr('Nombre de la suscripción {n}', { n: i + 1 })} onChange={(e) => editRow(subs, setSubs, i, { name: e.target.value })} />
                      <MoneyInput currency={currency} value={x.amount} onChange={(v) => editRow(subs, setSubs, i, { amount: v })} aria-label={tr('Monto de la suscripción {n}', { n: i + 1 })} />
                      <DaySelect label={tr('Día de cobro de la suscripción {n}', { n: i + 1 })} empty={tr('Sin fecha')} value={x.day} onChange={(d) => editRow(subs, setSubs, i, { day: d })} />
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between mt-5">
                <Button type="button" variant="ghost" icon="chevronLeft" onClick={() => go(step - 1)}>{tr('Anterior')}</Button>
                <Button type="button" onClick={() => go(step + 1)}>{tr('Siguiente')}<Icon name="chevronRight" size={16} /></Button>
              </div>
            </div>
          )}
          {step === OTHERS && (
            <div>
              <p className="text-[18px] font-semibold tracking-[-0.02em]">{tr('¿Tienes otros gastos mensuales?')}</p>
              <p className="text-[12.5px] text-muted">{tr('Añade los que falten, por ejemplo mascotas, ayuda familiar o mantenimiento.')}</p>
              <div className="space-y-2 mt-4">
                {extras.map((x, i) => (
                  <div key={i} className="grid grid-cols-[1fr_160px_auto] gap-2 items-center">
                    <Input value={x.name} placeholder={tr('Nombre del gasto')} onChange={(e) => editRow(extras, setExtras, i, { name: e.target.value })} />
                    <MoneyInput currency={currency} value={x.amount} onChange={(v) => editRow(extras, setExtras, i, { amount: v })} aria-label={tr('Importe')} />
                    <Button type="button" variant="ghost" size="sm" icon="trash" onClick={() => setExtras(extras.filter((_, j) => j !== i))}>{tr('Quitar')}</Button>
                  </div>
                ))}
                <Button type="button" variant="ghost" size="sm" icon="plus" onClick={() => setExtras([...extras, { name: '', amount: '' }])}>{tr('Añadir otro gasto')}</Button>
              </div>
              <div className="flex items-center justify-between mt-5">
                <Button type="button" variant="ghost" icon="chevronLeft" onClick={() => go(step - 1)}>{tr('Anterior')}</Button>
                <Button type="button" onClick={() => go(step + 1)}>{tr('Ver resultado')}<Icon name="chevronRight" size={16} /></Button>
              </div>
            </div>
          )}
          {step === RESULT && (
            <div>
              <div className="rounded-[20px] hero-surface text-[#F5F3EE] p-5">
                <div className="flex items-center justify-between"><p className="text-[12px] text-white/60">{tr('Tu mes en números')}</p><EstimateTag /></div>
                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div><p className="text-[11px] text-white/55">{tr('Ingreso mensual neto')}</p><Money animated cents={sum.income} currency={currency} className="text-[17px] font-semibold" /></div>
                  <div><p className="text-[11px] text-white/55">{tr('Gastos mensuales')}</p><Money animated cents={sum.expenses} currency={currency} className="text-[17px] font-semibold" /></div>
                  <div><p className="text-[11px] text-white/55">{tr('Fondo restante')}</p><Money animated cents={sum.remaining} currency={currency} className={`text-[22px] font-semibold ${sum.remaining >= 0 ? 'text-[#5BE0A8]' : 'text-[#FF9C8A]'}`} /></div>
                </div>
                <p className="text-[13px] mt-4 pt-4 border-t border-white/10 flex gap-2 items-start">
                  <Icon name={sum.canSave > 0 ? 'savings' : 'alert'} size={18} />
                  {income <= 0 ? tr('Aún no tienes ingresos configurados. Añádelos en Ingresos y salario para calcular cuánto puedes ahorrar.')
                    : sum.canSave > 0 ? <span>{tr('Sí puedes ahorrar. Te quedan hasta')}{' '}<Money cents={sum.canSave} currency={currency} className="font-semibold" />{' '}{tr('al mes ({pct} % de tu ingreso).', { pct: Math.round(sum.savingsRate) })}</span>
                      : sum.remaining === 0 ? tr('Tus gastos igualan tus ingresos: por ahora no queda margen para ahorrar.')
                        : <span>{tr('Tus gastos superan tus ingresos por')}{' '}<Money cents={-sum.remaining} currency={currency} className="font-semibold" />{' '}{tr('al mes. Revisa qué gastos puedes reducir.')}</span>}
                </p>
              </div>
              {items.length > 0 && (
                <ul className="mt-4 divide-y divide-line/60 rounded-[16px] border border-line">
                  {items.map((i) => (
                    <li key={i.name} className="flex justify-between gap-3 px-4 py-2.5 text-[13px]">
                      <span className="truncate">{i.name}{i.dueDay ? <span className="text-muted">{' · '}{tr('día {d}', { d: i.dueDay })}</span> : null}</span>
                      <Money cents={i.amount} currency={currency} />
                    </li>
                  ))}
                </ul>
              )}
              <Button type="button" variant="secondary" icon="edit" className="mt-4" onClick={() => go(0)}>{tr('Revisar gastos')}</Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

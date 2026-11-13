import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../store/app';
import { useMutate, useProfile } from '../../hooks/useDb';
import { createMember, setProfile } from '../../db/repo/core';
import { createAccount } from '../../db/repo/finance';
import { createIncomeSource, saveExpensePlan } from '../../db/repo/planning';
import { activeProfileId } from '../../db/adapters';
import { Button, Field, Input, Modal, MoneyInput, Toggle } from '../../components/ui';
import { IncomeConfigForm, draftToConfig, emptyDraft, type IncomeDraft } from '../income/IncomeConfigForm';
import { ExpensePlanner } from '../plan/ExpensePlanner';
import { estimateIncome } from '../../domain/salary';
import type { PlanItem } from '../../domain/plan';
import { parseMoney } from '../../lib/money';
import { today } from '../../lib/dates';
import { tr } from '../../lib/i18n';

export const PARTNER_SETUP_KEY = 'monto:partner-setup';
const STEPS = [tr('Tu pareja'), tr('Ingresos'), tr('Gastos'), tr('Cuenta')];

/** Turns the open profile into a couple profile, asking the partner's data like the initial setup. */
export function PartnerWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const profile = useProfile();
  const mutate = useMutate();
  const cur = profile.primaryCurrency;
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [noIncome, setNoIncome] = useState(false);
  const [employer, setEmployer] = useState('');
  const [income, setIncome] = useState<IncomeDraft>(() => emptyDraft(today()));
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [withAccount, setWithAccount] = useState(true);
  const [accName, setAccName] = useState('Banco General');
  const [accBalance, setAccBalance] = useState('');
  const [err, setErr] = useState('');
  const monthlyNet = useMemo(() => (noIncome ? 0 : estimateIncome(draftToConfig(income)).monthlyNet), [noIncome, income]);

  const next = () => {
    if (step === 0 && !name.trim()) return setErr(tr('Escribe el nombre de tu pareja.'));
    if (step === 1 && !noIncome && monthlyNet <= 0) return setErr(tr('Indica el salario de tu pareja o marca que no tiene ingresos.'));
    if (step === 3 && Number.isNaN(parseMoney(accBalance || '0'))) return setErr(tr('El saldo inicial no es válido.'));
    setErr('');
    if (step < STEPS.length - 1) return setStep(step + 1);
    const done = mutate((e, a) => e.transaction(() => {
      const m = createMember(e, a, { name: name.trim(), role: 'adult' });
      const acc = withAccount ? createAccount(e, a, { name: accName.trim() || tr('Cuenta de {name}', { name: name.trim() }), type: 'savings', currency: cur, initialBalance: parseMoney(accBalance || '0'), ownerMemberId: m.id }) : null;
      if (!noIncome) createIncomeSource(e, a, { name: employer.trim() || tr('Salario'), config: draftToConfig(income), currency: cur, accountId: acc?.id, startDate: today(), memberId: m.id });
      if (plan.length) saveExpensePlan(e, a, plan, m.id);
      setProfile(e, { mode: 'couple' });
    }), tr('{name} ya forma parte de tu perfil de pareja', { name: name.trim() }));
    if (done !== undefined) onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={tr('Perfil de pareja')} subtitle={tr('Paso {n} de {total}: {step}', { n: step + 1, total: STEPS.length, step: STEPS[step] })} icon="family" width={720}
      footer={<>
        <Button variant="ghost" onClick={() => (step ? setStep(step - 1) : onClose())}>{step ? tr('Atrás') : tr('Cancelar')}</Button>
        <Button onClick={next}>{step < STEPS.length - 1 ? tr('Continuar') : tr('Crear perfil de pareja')}</Button>
      </>}>
      {step === 0 && (
        <div className="space-y-3">
          <p className="text-[13px] text-ink-2">{tr('Tu pareja se añadirá como integrante adulto. Cada uno verá sus finanzas personales y las del hogar.')}</p>
          <Field label={tr('Nombre de tu pareja')}><Input autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={tr('Ej. Ana')} /></Field>
        </div>
      )}
      {step === 1 && (
        <div className="space-y-4">
          <Toggle checked={noIncome} onChange={setNoIncome} label={tr('Mi pareja no tiene ingresos por ahora')} />
          {!noIncome && <>
            <Field label={tr('¿Dónde trabaja?')}><Input value={employer} onChange={(e) => setEmployer(e.target.value)} placeholder={tr('Ej. Empresa Ejemplo, S.A.')} /></Field>
            <IncomeConfigForm net compact draft={income} set={(p) => setIncome({ ...income, ...p })} currency={cur} />
          </>}
        </div>
      )}
      {step === 2 && <ExpensePlanner income={monthlyNet} currency={cur} initial={plan} onChange={setPlan} />}
      {step === 3 && (
        <div className="space-y-4">
          <Toggle checked={withAccount} onChange={setWithAccount} label={tr('Crear una cuenta para tu pareja')} description={tr('Donde recibe su salario. Puedes añadir más cuentas después.')} />
          {withAccount && <div className="grid grid-cols-2 gap-3">
            <Field label={tr('Banco o nombre')}><Input value={accName} onChange={(e) => setAccName(e.target.value)} /></Field>
            <Field label={tr('Saldo inicial')}><MoneyInput currency={cur} value={accBalance} onChange={setAccBalance} aria-label={tr('Saldo inicial')} /></Field>
          </div>}
        </div>
      )}
      {err && <p className="text-[12.5px] text-coral mt-3">{err}</p>}
    </Modal>
  );
}

/** Opens the wizard right after Monto reopens on a copied profile made for the couple. */
export function PartnerSetupHost() {
  const [open, setOpen] = useState(false);
  const toast = useApp((s) => s.toast);
  useEffect(() => {
    try {
      if (localStorage.getItem(PARTNER_SETUP_KEY) !== activeProfileId()) return;
      localStorage.removeItem(PARTNER_SETUP_KEY);
    } catch { return; }
    toast({ kind: 'info', title: tr('Perfil copiado'), body: tr('Ahora añade los datos de tu pareja. Tu perfil original no cambió.') });
    setOpen(true);
  }, [toast]);
  return open ? <PartnerWizard open onClose={() => setOpen(false)} /> : null;
}

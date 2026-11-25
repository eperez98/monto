import { useState } from 'react';
import { EstimateTag, Field, Modal, Money, MoneyInput } from '../../components/ui';
import { applyDeductions, PANAMA_DEDUCTIONS } from '../../domain/salary';
import { parseMoney } from '../../lib/money';
import { tr } from '../../lib/i18n';

export function PanamaSalaryCalculator({ onClose }: { onClose: () => void }) {
  const [salary, setSalary] = useState('');
  const [periodEarnings, setPeriodEarnings] = useState('');
  const gross = parseMoney(salary);
  const earnings = periodEarnings.trim() ? parseMoney(periodEarnings) : gross * 4;
  const validSalary = Number.isSafeInteger(gross) && gross > 0;
  const validEarnings = Number.isSafeInteger(earnings) && earnings >= 0;
  const installment = Math.round(earnings / 12);
  const salaryDeductions = applyDeductions(gross, PANAMA_DEDUCTIONS);
  const installmentDeductions = applyDeductions(installment, PANAMA_DEDUCTIONS, true);

  return (
    <Modal open onClose={onClose} title={tr('Calculadora de salario y décimo')} subtitle={tr('Panamá')} icon="salary" width={580}>
      <div className="grid gap-4">
        <Field label={tr('Salario bruto mensual')} error={salary.trim() && !validSalary ? tr('Ingresa un salario mayor que cero.') : undefined}>
          <MoneyInput autoFocus value={salary} onChange={setSalary} aria-label={tr('Salario bruto mensual')} />
        </Field>
        <Field label={tr('Total bruto ganado en el período del décimo')} error={periodEarnings.trim() && !validEarnings ? tr('Ingresa un importe válido.') : undefined}>
          <MoneyInput value={periodEarnings} onChange={setPeriodEarnings} aria-label={tr('Total bruto ganado en el período del décimo')} />
        </Field>
        <p className="text-sm text-muted">{tr('Si dejas el segundo campo vacío, se estiman cuatro meses con el mismo salario. Ingresa el total real si trabajaste parte del período o si tu salario cambió.')}</p>
        {(validSalary || (periodEarnings.trim() && validEarnings)) && (
          <section aria-live="polite" className="rounded-2xl border border-line bg-surface-2 p-4">
            <EstimateTag />
            <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
              {validSalary && <>
                <dt>{tr('Descuentos mensuales de CSS y Seguro Educativo')}</dt><dd><Money cents={salaryDeductions} /></dd>
                <dt className="font-semibold">{tr('Salario mensual después de CSS y Seguro Educativo')}</dt><dd className="font-semibold"><Money cents={gross - salaryDeductions} /></dd>
              </>}
              {validEarnings && <>
                <dt>{tr('Partida bruta del décimo')}</dt><dd><Money cents={installment} /></dd>
                <dt>{tr('Descuento de CSS del décimo')}</dt><dd><Money cents={installmentDeductions} /></dd>
                <dt className="font-semibold">{tr('Partida del décimo después de CSS')}</dt><dd className="font-semibold"><Money cents={installment - installmentDeductions} /></dd>
              </>}
            </dl>
            <p className="mt-3 text-xs text-muted">{tr('Importes antes del impuesto sobre la renta (ISR) y otros descuentos.')}</p>
          </section>
        )}
      </div>
    </Modal>
  );
}

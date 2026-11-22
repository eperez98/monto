import { useMemo, useState } from 'react';
import { useProfile } from '../../hooks/useDb';
import { Card, CardHeader, Field, Input } from '../../components/ui';
import { Icon } from '../../icons';
import { bankFromSender, htmlToText, parseBankEmail } from '../../domain/bankMail';
import { formatMoney } from '../../lib/money';
import { formatDate, today } from '../../lib/dates';
import { tr } from '../../lib/i18n';

/**
 * Paste a bank alert and see what Monto reads from it, before connecting the mailbox or when an email is read wrong.
 * Nothing is saved or sent: the text stays in this box.
 */
export function MailTester() {
  const profile = useProfile();
  const [from, setFrom] = useState('');
  const [text, setText] = useState('');
  const parsed = useMemo(() => {
    if (!text.trim()) return undefined;
    const body = /<\w+[^>]*>/.test(text) ? htmlToText(text) : text;
    const [subject, ...rest] = body.split(/\r?\n/);
    return parseBankEmail({ subject, text: rest.join('\n'), date: today(), from }, profile?.country === 'CO' ? 'COP' : 'USD');
  }, [text, from, profile?.country]);
  const bank = from ? bankFromSender(from) : undefined;

  return (
    <Card hover={false}>
      <CardHeader title={tr('Probar un correo')} subtitle={tr('Pega un aviso de tu banco y mira qué entiende Monto. No se guarda ni se envía nada.')} />
      <div className="p-5 pt-2 grid md:grid-cols-[1.3fr_1fr] gap-5">
        <div className="space-y-3">
          <Field label={tr('Remitente (opcional)')} hint={bank ? tr('Banco reconocido: {bank}', { bank }) : undefined}>
            <Input value={from} onChange={(ev) => setFrom(ev.target.value)} placeholder="alertas@banco.com" spellCheck={false} />
          </Field>
          <Field label={tr('Asunto y texto del correo')} hint={tr('La primera línea se toma como asunto. También puedes pegar el HTML.')}>
            <textarea value={text} onChange={(ev) => setText(ev.target.value)} rows={7}
              className="w-full rounded-[14px] border border-line bg-surface px-3.5 py-2.5 text-[12.5px] leading-relaxed outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 resize-y"
              placeholder={`${tr('Compra aprobada')}
${tr('Se realizó una compra por USD 25.40 en SUPERMERCADO EJEMPLO con tu tarjeta terminada en 1234.')}`} />
          </Field>
        </div>
        <div className="rounded-[18px] border border-line/70 bg-surface-2/60 p-4 text-[12.5px]" aria-live="polite">
          {parsed === undefined && <p className="text-muted">{tr('Aquí verás el monto, el comercio y si es un gasto o un ingreso.')}</p>}
          {parsed === null && <p className="flex gap-2 text-amber"><Icon name="alert" size={16} />{tr('Monto no encontró un monto en este correo, así que no lo agregaría.')}</p>}
          {parsed && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-muted">{tr('Tipo')}</dt><dd className="font-medium">{parsed.type === 'expense' ? tr('Gasto') : tr('Ingreso')}</dd>
              <dt className="text-muted">{tr('Monto')}</dt><dd className="font-semibold tabular-nums">{formatMoney(parsed.amount, parsed.currency)}</dd>
              <dt className="text-muted">{tr('Comercio')}</dt><dd className="font-medium break-words">{parsed.merchant || '—'}</dd>
              <dt className="text-muted">{tr('Fecha')}</dt><dd>{formatDate(parsed.date)}</dd>
              {(parsed.bank || bank) && <><dt className="text-muted">{tr('Banco')}</dt><dd>{parsed.bank || bank}</dd></>}
            </dl>
          )}
        </div>
      </div>
    </Card>
  );
}

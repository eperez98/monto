import { useState } from 'react';
import {
  Button,
  Card,
  Field,
  Input,
  MoneyInput,
  Modal,
  PageHeader,
  Select,
  useConfirm,
} from '../../components/ui';
import { useActor, useCan, useEngine, useMutate, useProfile, useQuery } from '../../hooks/useDb';
import {
  approveQuote,
  approvalEvidence,
  evidenceLimit,
  expires,
  installments,
  lineAmount,
  quoteTotal,
  closeQuote,
  quotes,
  saveQuote,
  type Quote,
  type QuoteDraft,
} from '../../db/repo/quotes';
import { centsToInput, formatMoney, parseMoney } from '../../lib/money';
import { tr } from '../../lib/i18n';
import { exportPDF, type ReportTable } from '../../services/export';
import { useApp } from '../../store/app';

import { saveFile } from '../../services/files';
import { today } from '../../lib/dates';

const basisLabels = () => ({ unit: tr('Por unidad'), hour: tr('Por hora'), day: tr('Por día') });
const termLabels = () => ({
  start: tr('Pago único al iniciar la tarea'),
  finish: tr('Pago al finalizar la tarea, dentro de 15 días'),
  split: tr('Anticipo al iniciar y saldo al finalizar'),
});
function paymentText(amount: number, terms: QuoteDraft['terms']) {
  if (terms.kind !== 'split') return termLabels()[terms.kind];
  const { initial, final } = installments(amount, terms);
  return tr('Al iniciar: {p}% ({a}). Al finalizar: {f}% ({b}).', {
    p: terms.percent,
    a: formatMoney(initial),
    f: Number((100 - terms.percent).toFixed(2)),
    b: formatMoney(final),
  });
}
const labels = () => ({
  company: tr('Empresa destinataria'),
  phone: tr('Teléfono de contacto'),
  email: tr('Correo de contacto'),
  issuer: tr('Nombre del emisor'),
  cedula: tr('Cédula'),
  ruc: tr('RUC (opcional)'),
  bank: tr('Nombre del banco'),
  account: tr('Número de cuenta'),
});
const typeLabel = (type: QuoteDraft['accountType']) => (type === 'savings' ? tr('Ahorros') : tr('Corriente'));
const total = quoteTotal;
const status = (q: Quote) =>
  q.outcome.status === 'paid'
    ? tr('Cobrada')
    : q.outcome.status === 'cancelled'
      ? tr('Cancelada')
      : q.outcome.status === 'approved'
        ? tr('Aprobada')
        : expires(q) < today()
          ? tr('Vencida')
          : tr('Pendiente');

async function download(q: Quote, receipt = false) {
  const paid = receipt && q.outcome.status === 'paid' ? q.outcome : null;
  const heading = paid ? tr('Recibo') : tr('Cotización');
  const table = (name: string, rows: [string, string][]): ReportTable => ({
    name,
    columns: [
      { key: 'field', label: tr('Detalle') },
      { key: 'value', label: tr('Información') },
    ],
    rows: rows.map(([field, value]) => ({ field, value })),
  });
  return exportPDF(
    {
      title: heading,
      signatures: paid ? undefined : [tr('Firma de aprobación del cliente'), tr('Firma del profesional')],
      subtitle: q.company + ' · ' + (paid?.paidOn ?? q.date),
      tables: [
        table(tr('Datos del documento'), [
          [tr('Cotización'), q.id],
          ...(paid ? [[tr('Recibo'), paid.receiptId] as [string, string]] : []),
          [tr('Empresa destinataria'), q.company],
          ...(q.phone ? [[tr('Teléfono de contacto'), q.phone] as [string, string]] : []),
          ...(q.email ? [[tr('Correo de contacto'), q.email] as [string, string]] : []),
          ...(q.validUntil || q.outcome.status === 'open'
            ? [[tr('Válida hasta'), expires(q)] as [string, string]]
            : []),
          ...(q.approvedOn ? [[tr('Fecha de aprobación'), q.approvedOn] as [string, string]] : []),
          ...(q.terms
            ? [[tr('Condiciones de pago'), paymentText(total(q), q.terms)] as [string, string]]
            : []),
          [tr('Nombre del emisor'), q.issuer],
          [tr('Cédula'), q.cedula],
          ...(q.ruc ? [['RUC', q.ruc] as [string, string]] : []),
          [tr('Estado'), status(q)],
          ...(q.outcome.status === 'cancelled' ? [[tr('Motivo'), q.outcome.reason] as [string, string]] : []),
        ]),
        {
          name: tr('Servicios'),
          columns: [
            { key: 'description', label: tr('Descripción') },
            { key: 'basis', label: tr('Tarifa') },
            { key: 'qty', label: tr('Cantidad') },
            { key: 'rate', label: tr('Precio (PAB)'), money: true, align: 'right' },
            { key: 'value', label: tr('Importe (PAB)'), money: true, align: 'right' },
          ],
          rows: [
            ...q.lines.map((l) => ({
              description: l.description,
              basis: basisLabels()[l.basis],
              qty: l.hundredths / 100,
              rate: l.cents,
              value: lineAmount(l.cents, l.hundredths),
            })),
            { description: tr('Total'), value: total(q) },
          ],
        },
        table(tr('Información bancaria para pagos'), [
          [tr('Método de pago'), 'ACH'],
          [tr('Nombre del banco'), q.bank],
          [tr('Tipo de cuenta'), typeLabel(q.accountType)],
          [tr('Número de cuenta'), q.account],
        ]),
      ],
    },
    (paid ? 'recibo-' : 'cotizacion-') + (paid?.receiptId ?? q.id),
  );
}

function Editor({ quote, onClose }: { quote?: Quote; onClose: () => void }) {
  const mutate = useMutate();
  const [fields, setFields] = useState({
    company: quote?.company ?? '',
    phone: quote?.phone ?? '',
    email: quote?.email ?? '',
    issuer: quote?.issuer ?? '',
    cedula: quote?.cedula ?? '',
    ruc: quote?.ruc ?? '',
    bank: quote?.bank ?? '',
    account: quote?.account ?? '',
  });
  const [accountType, setType] = useState<QuoteDraft['accountType']>(quote?.accountType ?? 'savings');
  const [kind, setKind] = useState<QuoteDraft['terms']['kind']>(quote?.terms?.kind ?? 'start');
  const [percent, setPercent] = useState(String(quote?.terms?.kind === 'split' ? quote.terms.percent : 50));
  const terms: QuoteDraft['terms'] = kind === 'split' ? { kind, percent: Number(percent) } : { kind };
  const blankLine = {
    description: '',
    price: '',
    basis: 'unit' as QuoteDraft['lines'][number]['basis'],
    qty: '1',
  };
  const [lines, setLines] = useState(
    quote?.lines.map((l) => ({
      description: l.description,
      price: centsToInput(l.cents),
      basis: l.basis,
      qty: String(l.hundredths / 100),
    })) ?? [blankLine],
  );
  const names = labels();
  const entered = lines.map((l) => ({
    description: l.description,
    cents: parseMoney(l.price),
    basis: l.basis,
    hundredths: /^\d+(?:[.,]\d{1,2})?$/.test(l.qty) ? Math.round(Number(l.qty.replace(',', '.')) * 100) : NaN,
  }));
  const amount = entered.reduce((sum, l) => sum + lineAmount(l.cents, l.hundredths), 0);
  const valid =
    Number.isSafeInteger(amount) &&
    entered.every(
      (l) =>
        l.description.trim() &&
        l.cents > 0 &&
        l.hundredths > 0 &&
        l.hundredths <= 100000000 &&
        Number.isSafeInteger(l.cents * l.hundredths) &&
        lineAmount(l.cents, l.hundredths) <= 10000000000,
    ) &&
    (terms.kind !== 'split' ||
      (terms.percent > 0 && terms.percent < 100 && /^\d+(?:[.]\d{1,2})?$/.test(percent)));
  const field = (k: keyof typeof names) => (
    <Field key={k} label={names[k]}>
      <Input
        value={fields[k]}
        type={k === 'email' ? 'email' : k === 'phone' ? 'tel' : 'text'}
        maxLength={k === 'ruc' ? 60 : 180}
        onChange={(ev) => setFields({ ...fields, [k]: ev.target.value })}
      />
    </Field>
  );
  const save = () => {
    if (
      mutate(
        (e, a) =>
          saveQuote(
            e,
            a,
            {
              ...fields,
              accountType,
              lines: entered,
              terms,
            },
            quote?.id,
          ),
        tr('Cotización guardada'),
      )
    )
      onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={quote ? tr('Editar cotización') : tr('Nueva cotización')}
      width={660}
      footer={
        <Button disabled={!valid} onClick={save}>
          {tr('Guardar')}
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {field('company')}
        {field('phone')}
        {field('email')}
        <h3 className="sm:col-span-2 mt-2 font-semibold">{tr('Datos del profesional')}</h3>
        {field('issuer')}
        {field('cedula')}
        {field('ruc')}
        <h3 className="sm:col-span-2 mt-2 font-semibold">{tr('Información bancaria para pagos')} · ACH</h3>
        {field('bank')}
        {field('account')}
        <Field label={tr('Tipo de cuenta')}>
          <Select value={accountType} onChange={(ev) => setType(ev.target.value as typeof accountType)}>
            <option value="savings">{typeLabel('savings')}</option>
            <option value="checking">{typeLabel('checking')}</option>
          </Select>
        </Field>
      </div>
      <p className="my-4 font-semibold">
        {tr('Servicios')} · {tr('Pago por ACH')}
      </p>
      {lines.map((l, i) => (
        <div key={i} className="mb-3 grid gap-2 sm:grid-cols-2 rounded-xl border border-line p-3 items-end">
          <Field label={tr('Descripción')}>
            <Input
              value={l.description}
              maxLength={500}
              onChange={(ev) =>
                setLines(lines.map((x, n) => (n === i ? { ...x, description: ev.target.value } : x)))
              }
            />
          </Field>
          <Field label={tr('Tarifa')}>
            <Select
              value={l.basis}
              onChange={(ev) =>
                setLines(
                  lines.map((x, n) => (n === i ? { ...x, basis: ev.target.value as typeof l.basis } : x)),
                )
              }
            >
              {Object.entries(basisLabels()).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={l.basis === 'hour' ? tr('Horas') : l.basis === 'day' ? tr('Días') : tr('Unidades')}>
            <Input
              inputMode="decimal"
              value={l.qty}
              onChange={(ev) => setLines(lines.map((x, n) => (n === i ? { ...x, qty: ev.target.value } : x)))}
            />
          </Field>
          <Field label={tr('Precio (PAB)')}>
            <MoneyInput
              value={l.price}
              onChange={(price) => setLines(lines.map((x, n) => (n === i ? { ...x, price } : x)))}
            />
          </Field>
          {lines.length > 1 && (
            <Button variant="ghost" onClick={() => setLines(lines.filter((_, n) => n !== i))}>
              {tr('Quitar')}
            </Button>
          )}
        </div>
      ))}
      <Button
        variant="secondary"
        disabled={lines.length >= 50}
        onClick={() => setLines([...lines, blankLine])}
      >
        {tr('Agregar servicio')}
      </Button>
      <div className="grid gap-3 mt-5">
        <Field label={tr('Condiciones de pago')}>
          <Select value={kind} onChange={(ev) => setKind(ev.target.value as typeof kind)}>
            {Object.entries(termLabels()).map(([k, text]) => (
              <option value={k} key={k}>
                {text}
              </option>
            ))}
          </Select>
        </Field>
        {kind === 'split' && (
          <Field label={tr('Porcentaje al iniciar')}>
            <Input
              type="number"
              min={0.01}
              max={99.99}
              step={0.01}
              value={percent}
              onChange={(ev) => setPercent(ev.target.value)}
            />
          </Field>
        )}
        {valid && (
          <>
            <strong>
              {tr('Total')} · {formatMoney(amount)}
            </strong>
            <p>{paymentText(amount, terms)}</p>
          </>
        )}
        <p>{tr('Validez de la cotización: 15 días desde la emisión.')}</p>
      </div>
    </Modal>
  );
}
export default function Quotes() {
  const profile = useProfile();
  return (profile.country ?? 'PA') === 'PA' ? <Inventory /> : <p>{tr('Disponible solo en Panamá')}</p>;
}
function ApprovalForm({ onApprove }: { onApprove: (file: File) => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-2 w-full rounded-xl border border-line p-3">
      <Field
        label={tr('Evidencia de aprobación')}
        hint={tr('Selecciona una captura PNG o JPG, o un PDF firmado.')}
      >
        <Input
          type="file"
          accept="image/png,image/jpeg,application/pdf"
          onChange={(ev) => setFile(ev.target.files?.[0] ?? null)}
        />
      </Field>
      <Button
        disabled={!file || busy}
        onClick={async () => {
          if (!file) return;
          setBusy(true);
          try {
            await onApprove(file);
          } finally {
            setBusy(false);
          }
        }}
      >
        {tr('Aprobar cotización')}
      </Button>
    </div>
  );
}
function Inventory() {
  const engine = useEngine();
  const a = useActor(),
    list = useQuery((e) => quotes(e, a), [a.id]),
    manage = useCan('income.manage'),
    mutate = useMutate(),
    confirm = useConfirm(),
    toast = useApp((s) => s.toast);
  const [editor, setEditor] = useState<Quote | null | undefined>(undefined),
    [selected, setSelected] = useState(''),
    [cancel, setCancel] = useState(false),
    [reason, setReason] = useState('');
  const q = list.find((v) => v.id === selected);
  const upload = async (item: Quote, file: File) => {
    try {
      if (file.size > evidenceLimit) throw new Error(tr('La evidencia debe pesar como máximo 8 MB.'));
      const bytes = new Uint8Array(await file.arrayBuffer());
      mutate((e, a) => approveQuote(e, a, item.id, bytes), tr('Cotización aprobada'));
    } catch (err) {
      toast({ kind: 'error', title: tr('Operación fallida'), body: (err as Error).message });
    }
  };
  const evidence = async (item: Quote) => {
    try {
      const { bytes, extension } = approvalEvidence(engine, a, item.id);
      await saveFile('aprobacion-' + item.id + '.' + extension, bytes, [
        { name: tr('Evidencia de aprobación'), extensions: [extension] },
      ]);
    } catch (err) {
      toast({ kind: 'error', title: tr('Operación fallida'), body: (err as Error).message });
    }
  };
  const pdf = (item: Quote, receipt = false) =>
    void download(item, receipt).catch((err: Error) =>
      toast({ kind: 'error', title: tr('Operación fallida'), body: err.message }),
    );
  return (
    <div>
      <PageHeader
        title={tr('El Cotizador')}
        subtitle={tr('Inventario de cotizaciones y recibos ACH')}
        actions={
          manage && (
            <Button icon="plus" onClick={() => setEditor(null)}>
              {tr('Nueva cotización')}
            </Button>
          )
        }
      />
      <Card className="p-4">
        {!list.length ? (
          <p>{tr('Aún no tienes cotizaciones.')}</p>
        ) : (
          list.map((v) => (
            <button
              key={v.id}
              className="flex w-full items-center justify-between gap-3 border-b border-line p-3 text-left"
              onClick={() => setSelected(v.id)}
            >
              <span>
                {v.company}
                <small className="block text-muted">
                  {v.date} · {status(v)}
                </small>
              </span>
              <strong>{formatMoney(total(v))}</strong>
            </button>
          ))
        )}
      </Card>
      {q && editor === undefined && !cancel && (
        <Modal
          open
          onClose={() => setSelected('')}
          title={q.company}
          subtitle={q.date + ' · ' + status(q)}
          width={560}
        >
          <dl className="space-y-2">
            {q.lines.map((l, i) => (
              <div className="flex justify-between gap-3" key={i}>
                <dt>{l.description}</dt>
                <dd>
                  {l.hundredths / 100} × {formatMoney(l.cents)} ({basisLabels()[l.basis]}) ={' '}
                  {formatMoney(lineAmount(l.cents, l.hundredths))}
                </dd>
              </div>
            ))}
          </dl>
          <p className="my-4 font-semibold">
            {tr('Total')} · {formatMoney(total(q))}
          </p>
          {q.terms && <p>{paymentText(total(q), q.terms)}</p>}
          {(q.validUntil || q.outcome.status === 'open') && (
            <p>
              {tr('Válida hasta')} · {expires(q)}
            </p>
          )}
          {q.approvedOn && (
            <Button variant="secondary" onClick={() => void evidence(q)}>
              {tr('Evidencia de aprobación')}
            </Button>
          )}
          {q.outcome.status === 'cancelled' && (
            <p>
              {tr('Motivo')} · {q.outcome.reason}
            </p>
          )}
          {q.outcome.status === 'paid' && (
            <p>
              {tr('Recibo')} · {q.outcome.receiptId} · {q.outcome.paidOn}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => pdf(q)}>
              {tr('Cotización PDF')}
            </Button>
            {q.outcome.status === 'paid' && <Button onClick={() => pdf(q, true)}>{tr('Recibo PDF')}</Button>}
            {manage && q.outcome.status === 'approved' && (
              <Button
                onClick={() =>
                  confirm.ask({
                    title: tr('¿Confirmar cobro por ACH?'),
                    body: formatMoney(total(q)) + ' · ' + q.company,
                    confirmLabel: tr('Marcar como cobrada'),
                    onConfirm: () => {
                      mutate((e, a) => closeQuote(e, a, q.id), tr('Recibo generado'));
                    },
                  })
                }
              >
                {tr('Marcar como cobrada')}
              </Button>
            )}
            {manage && q.outcome.status === 'open' && (
              <>
                {expires(q) >= today() ? (
                  <ApprovalForm key={q.id} onApprove={(file) => upload(q, file)} />
                ) : (
                  <p>{tr('Cotización vencida. Edítala para renovar su vigencia.')}</p>
                )}
                <Button variant="secondary" onClick={() => setEditor(q)}>
                  {tr('Editar')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setReason('');
                    setCancel(true);
                  }}
                >
                  {tr('Cancelar cotización')}
                </Button>
              </>
            )}
          </div>
        </Modal>
      )}
      {editor !== undefined && <Editor quote={editor ?? undefined} onClose={() => setEditor(undefined)} />}
      {q && cancel && (
        <Modal
          open
          title={tr('Cancelar cotización')}
          onClose={() => setCancel(false)}
          footer={
            <Button
              disabled={!reason.trim()}
              onClick={() => {
                if (mutate((e, a) => closeQuote(e, a, q.id, reason))) setCancel(false);
              }}
            >
              {tr('Confirmar')}
            </Button>
          }
        >
          <Field label={tr('Motivo')}>
            <Input autoFocus maxLength={180} value={reason} onChange={(ev) => setReason(ev.target.value)} />
          </Field>
        </Modal>
      )}
      {confirm.node}
    </div>
  );
}

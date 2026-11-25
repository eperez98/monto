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
import { useActor, useCan, useMutate, useProfile, useQuery } from '../../hooks/useDb';
import { closeQuote, quotes, saveQuote, type Quote, type QuoteDraft } from '../../db/repo/quotes';
import { centsToInput, formatMoney, parseMoney } from '../../lib/money';
import { tr } from '../../lib/i18n';
import { exportPDF, type ReportTable } from '../../services/export';
import { useApp } from '../../store/app';

const labels = () => ({
  company: tr('Empresa destinataria'),
  issuer: tr('Nombre del emisor'),
  cedula: tr('Cédula'),
  ruc: tr('RUC (opcional)'),
  bank: tr('Nombre del banco'),
  account: tr('Número de cuenta'),
});
const typeLabel = (type: QuoteDraft['accountType']) => (type === 'savings' ? tr('Ahorros') : tr('Corriente'));
const total = (q: Quote) => q.lines.reduce((sum, line) => sum + line.cents, 0);
const status = (q: Quote) =>
  q.outcome.status === 'paid'
    ? tr('Cobrada')
    : q.outcome.status === 'cancelled'
      ? tr('Cancelada')
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
      subtitle: q.company + ' · ' + (paid?.paidOn ?? q.date),
      tables: [
        table(tr('Datos del documento'), [
          [tr('Cotización'), q.id],
          ...(paid ? [[tr('Recibo'), paid.receiptId] as [string, string]] : []),
          [tr('Empresa destinataria'), q.company],
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
            { key: 'value', label: tr('Precio (PAB)'), money: true, align: 'right' },
          ],
          rows: [
            ...q.lines.map((l) => ({ description: l.description, value: l.cents })),
            { description: tr('Total'), value: total(q) },
          ],
        },
        table(tr('Pago por ACH'), [
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
    issuer: quote?.issuer ?? '',
    cedula: quote?.cedula ?? '',
    ruc: quote?.ruc ?? '',
    bank: quote?.bank ?? '',
    account: quote?.account ?? '',
  });
  const [accountType, setType] = useState<QuoteDraft['accountType']>(quote?.accountType ?? 'savings');
  const [lines, setLines] = useState(
    quote?.lines.map((l) => ({ description: l.description, price: centsToInput(l.cents) })) ?? [
      { description: '', price: '' },
    ],
  );
  const names = labels();
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
              lines: lines.map((l) => ({ description: l.description, cents: parseMoney(l.price) })),
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
      footer={<Button onClick={save}>{tr('Guardar')}</Button>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {(Object.keys(names) as (keyof typeof names)[]).map((k) => (
          <Field key={k} label={names[k]}>
            <Input
              value={fields[k]}
              maxLength={k === 'ruc' ? 60 : 180}
              onChange={(ev) => setFields({ ...fields, [k]: ev.target.value })}
            />
          </Field>
        ))}
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
        <div key={i} className="mb-3 grid gap-2 sm:grid-cols-[2fr_1fr_auto] items-end">
          <Field label={tr('Descripción')}>
            <Input
              value={l.description}
              maxLength={500}
              onChange={(ev) =>
                setLines(lines.map((x, n) => (n === i ? { ...x, description: ev.target.value } : x)))
              }
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
        onClick={() => setLines([...lines, { description: '', price: '' }])}
      >
        {tr('Agregar servicio')}
      </Button>
    </Modal>
  );
}
export default function Quotes() {
  const profile = useProfile();
  return (profile.country ?? 'PA') === 'PA' ? <Inventory /> : <p>{tr('Disponible solo en Panamá')}</p>;
}
function Inventory() {
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
                <dd>{formatMoney(l.cents)}</dd>
              </div>
            ))}
          </dl>
          <p className="my-4 font-semibold">
            {tr('Total')} · {formatMoney(total(q))}
          </p>
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
            {manage && q.outcome.status === 'open' && (
              <>
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

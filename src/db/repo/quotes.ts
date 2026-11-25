import { z } from 'zod';
import { uid, type Engine } from '../engine';
import type { Actor } from '../types';
import { assertCan } from '../../domain/permissions';
import { getProfile, getSetting, setSetting } from './core';
import { addDays, today } from '../../lib/dates';
import { tr } from '../../lib/i18n';

const text = z.string().trim().min(1).max(180);
const line = z
  .object({
    description: z.string().trim().min(1).max(500),
    cents: z.number().int().positive().max(100_000_000_00),
    basis: z.enum(['unit', 'hour', 'day']).default('unit'),
    hundredths: z.number().int().min(1).max(100_000_000).default(100),
  })
  .refine(
    (l) =>
      Number.isSafeInteger(l.cents * l.hundredths) && lineAmount(l.cents, l.hundredths) <= 10_000_000_000,
  );
const draft = z.object({
  company: text,
  phone: z
    .string()
    .trim()
    .regex(/^[+\d][\d ()-]{5,29}$/),
  email: z.string().trim().email().max(180),
  terms: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('start') }),
    z.object({ kind: z.literal('finish') }),
    z.object({ kind: z.literal('split'), percent: z.number().min(0.01).max(99.99).multipleOf(0.01) }),
  ]),
  issuer: text,
  cedula: text,
  ruc: z.string().trim().max(60),
  bank: text,
  accountType: z.enum(['savings', 'checking']),
  account: text,
  lines: z.array(line).min(1).max(50),
});
export type QuoteDraft = z.infer<typeof draft>;
type Outcome =
  | { status: 'open' }
  | { status: 'approved' }
  | { status: 'cancelled'; reason: string }
  | { status: 'paid'; paidOn: string; receiptId: string };
export type Quote = Omit<QuoteDraft, 'phone' | 'email' | 'terms'> &
  Partial<Pick<QuoteDraft, 'phone' | 'email' | 'terms'>> & {
    id: string;
    date: string;
    validUntil?: string;
    approvedOn?: string;
    outcome: Outcome;
  };
export const lineAmount = (rate: number, hundredths: number) => Math.round((rate * hundredths) / 100);
export const quoteTotal = (q: Quote) =>
  q.lines.reduce((sum, l) => sum + lineAmount(l.cents, l.hundredths), 0);
export function installments(amount: number, terms: QuoteDraft['terms']) {
  const initial =
    terms.kind === 'start'
      ? amount
      : terms.kind === 'finish'
        ? 0
        : Math.round((amount * Math.round(terms.percent * 100)) / 10000);
  return { initial, final: amount - initial };
}
export const expires = (q: Quote) => q.validUntil ?? addDays(q.date, 15);
function key(e: Engine, actor: Actor) {
  if ((getProfile(e).country ?? 'PA') !== 'PA') throw new Error(tr('Disponible solo en Panamá'));
  return 'quotes:' + actor.id;
}
export function quotes(e: Engine, a: Actor): Quote[] {
  return getSetting(e, key(e, a), { items: [] as Quote[] }).items.map((q) => ({
    ...q,
    lines: q.lines.map((l) => ({ ...l, basis: l.basis ?? 'unit', hundredths: l.hundredths ?? 100 })),
  }));
}
function persist(e: Engine, a: Actor, items: Quote[]) {
  setSetting(e, key(e, a), { items });
}
function openQuote(items: Quote[], id: string) {
  const q = items.find((item) => item.id === id);
  if (!q || q.outcome.status !== 'open')
    throw new Error(tr('Solo puedes modificar una cotización pendiente.'));
  return q;
}
export function saveQuote(e: Engine, a: Actor, input: QuoteDraft, id?: string) {
  assertCan(a.role, 'income.manage');
  const data = draft.parse(input);
  const items = quotes(e, a);
  const date = today();
  if (id) {
    const q = openQuote(items, id);
    if (expires(q) < date) q.date = date;
    Object.assign(q, data, { validUntil: addDays(q.date, 15) });
  } else
    items.unshift({ ...data, id: uid(), date, validUntil: addDays(date, 15), outcome: { status: 'open' } });
  persist(e, a, items);
}
export function closeQuote(e: Engine, a: Actor, id: string, reason?: string) {
  assertCan(a.role, 'income.manage');
  const items = quotes(e, a);
  if (reason === undefined) {
    const q = items.find((item) => item.id === id);
    if (q?.outcome.status !== 'approved') throw new Error(tr('Primero debes aprobar la cotización.'));
    q.outcome = { status: 'paid', paidOn: today(), receiptId: uid() };
  } else openQuote(items, id).outcome = { status: 'cancelled', reason: text.parse(reason) };
  persist(e, a, items);
}

export const evidenceLimit = 8 * 1024 * 1024;
function evidenceType(bytes: Uint8Array) {
  if (bytes.length > evidenceLimit) throw new Error(tr('La evidencia debe pesar como máximo 8 MB.'));
  const starts = (signature: number[]) => signature.every((b, i) => bytes[i] === b);
  if (starts([37, 80, 68, 70, 45])) return 'pdf';
  if (starts([137, 80, 78, 71, 13, 10, 26, 10])) return 'png';
  if (starts([255, 216, 255])) return 'jpg';
  throw new Error(tr('Selecciona una captura PNG o JPG, o un PDF firmado.'));
}
export function approveQuote(e: Engine, a: Actor, id: string, bytes: Uint8Array) {
  assertCan(a.role, 'income.manage');
  const items = quotes(e, a),
    q = openQuote(items, id);
  if (expires(q) < today()) throw new Error(tr('Cotización vencida. Edítala para renovar su vigencia.'));
  const extension = evidenceType(bytes);
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 32768)
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 32768)));
  e.transaction(() => {
    setSetting(e, key(e, a) + ':evidence:' + id, { extension, data: btoa(chunks.join('')) });
    q.outcome = { status: 'approved' };
    q.approvedOn = today();
    persist(e, a, items);
  });
}
export function approvalEvidence(e: Engine, a: Actor, id: string) {
  const { data, extension } = getSetting(e, key(e, a) + ':evidence:' + id, { data: '', extension: '' });
  if (!data) throw new Error(tr('Falta la evidencia de aprobación.'));
  return { extension, bytes: Uint8Array.from(atob(data), (c) => c.charCodeAt(0)) };
}

import { z } from 'zod';
import { uid, type Engine } from '../engine';
import type { Actor } from '../types';
import { assertCan } from '../../domain/permissions';
import { getProfile, getSetting, setSetting } from './core';
import { today } from '../../lib/dates';
import { tr } from '../../lib/i18n';

const text = z.string().trim().min(1).max(180);
const line = z.object({
  description: z.string().trim().min(1).max(500),
  cents: z.number().int().positive().max(100_000_000_00),
});
const draft = z.object({
  company: text,
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
  | { status: 'cancelled'; reason: string }
  | { status: 'paid'; paidOn: string; receiptId: string };
export type Quote = QuoteDraft & { id: string; date: string; outcome: Outcome };
function key(e: Engine, actor: Actor) {
  if ((getProfile(e).country ?? 'PA') !== 'PA') throw new Error(tr('Disponible solo en Panamá'));
  return 'quotes:' + actor.id;
}
export function quotes(e: Engine, a: Actor): Quote[] {
  return getSetting(e, key(e, a), { items: [] as Quote[] }).items;
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
  if (id) Object.assign(openQuote(items, id), data);
  else items.unshift({ ...data, id: uid(), date: today(), outcome: { status: 'open' } });
  persist(e, a, items);
}
export function closeQuote(e: Engine, a: Actor, id: string, reason?: string) {
  assertCan(a.role, 'income.manage');
  const items = quotes(e, a);
  openQuote(items, id).outcome =
    reason === undefined
      ? { status: 'paid', paidOn: today(), receiptId: uid() }
      : { status: 'cancelled', reason: text.parse(reason) };
  persist(e, a, items);
}

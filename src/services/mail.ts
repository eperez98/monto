/**
 * Optional: read transactions from the user's bank notification emails (Gmail or Outlook), desktop only.
 * Once connected, the access lives in the Windows Credential Manager (handled by the desktop side, never
 * stored in Monto's database or backups) so Monto can sync when it opens. The user always reviews what
 * was found before anything is added.
 */
import type { Engine } from '../db/engine';
import { isTauri } from '../db/adapters';
import { getSetting, setSetting } from '../db/repo/core';
import { createTransaction } from '../db/repo/finance';
import { categoryFor, getCategoryRules } from '../db/repo/rules';
import { assertCan } from '../domain/permissions';
import { fromGmail, fromGraph, parseBankEmail, type ParsedTx } from '../domain/bankMail';
import { addDays, today, type ISODate } from '../lib/dates';
import type { Actor } from '../db/types';
import { tr } from '../lib/i18n';

export type MailProvider = 'google' | 'microsoft';
/** Non-secret settings only. The client ID is a public identifier, not a credential. */
export interface MailPrefs { provider: MailProvider; clientId: string; subject: string; since: ISODate; accountId: string; connected: boolean; lastSync: string }
/** One transaction read from an email. `name` starts as the merchant and the user may edit it. */
export interface MailCandidate { key: string; subject: string; tx: ParsedTx; name: string; duplicate: boolean }
export interface MailSyncResult { read: number; alreadyImported: number; noAmount: number; candidates: MailCandidate[] }

const CFG = 'mailSync';
const SEEN = 'mailImported';
const defaults = (): MailPrefs => ({ provider: 'google', clientId: '', subject: '', since: addDays(today(), -30), accountId: '', connected: false, lastSync: '' });

export const mailSupported = () => isTauri();
export function getMailPrefs(e: Engine): MailPrefs {
  const d = defaults();
  const c = getSetting<Partial<MailPrefs>>(e, CFG, {});
  return { provider: c.provider ?? d.provider, clientId: c.clientId ?? '', subject: c.subject ?? '', since: c.since ?? d.since, accountId: c.accountId ?? '', connected: !!c.connected, lastSync: c.lastSync ?? '' };
}
export function saveMailPrefs(e: Engine, actor: Actor, patch: Partial<MailPrefs>) {
  assertCan(actor.role, 'account.manage');
  // Written field by field, so nothing else (for example a token from an older build) is ever kept.
  const c = { ...getMailPrefs(e), ...patch };
  setSetting(e, CFG, { provider: c.provider, clientId: c.clientId.trim(), subject: c.subject.trim(), since: c.since, accountId: c.accountId, connected: c.connected, lastSync: c.lastSync });
}
const seen = (e: Engine) => new Set(getSetting<{ items: string[] }>(e, SEEN, { items: [] }).items);

const b64url = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = (n: number) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const sha = async (s: string) => b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))).slice(0, 22);
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Sign in once in the browser; the desktop side keeps the connection in the Windows vault. */
export async function connectMail(e: Engine, actor: Actor, prefs: Omit<MailPrefs, 'connected' | 'lastSync'>, clientSecret: string): Promise<void> {
  assertCan(actor.role, 'account.manage');
  if (!prefs.clientId.trim() || !prefs.subject.trim()) throw new Error(tr('Indica el ID de cliente y el asunto.'));
  const verifier = random(48);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('mail_connect', { provider: prefs.provider, clientId: prefs.clientId.trim(), clientSecret: clientSecret.trim() || null, challenge, verifier, state: random(16) });
  saveMailPrefs(e, actor, { ...prefs, connected: true });
  await e.flush();
}

export async function disconnectMail(e: Engine, actor: Actor): Promise<void> {
  assertCan(actor.role, 'account.manage');
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('mail_disconnect', { provider: getMailPrefs(e).provider });
  saveMailPrefs(e, actor, { connected: false });
}

/** Already in the account history: same merchant (by name) and same amount, within 2 days. */
function alreadyRecorded(e: Engine, tx: ParsedTx): boolean {
  const rows = e.all<{ description: string }>('SELECT description FROM transactions WHERE type = ? AND amount = ? AND date BETWEEN ? AND ?', [tx.type, tx.amount, addDays(tx.date, -2), addDays(tx.date, 2)]);
  const m = norm(tx.merchant);
  return rows.some((r) => { const d = norm(r.description); return !!m && (d === m || d.includes(m) || m.includes(d)); });
}

/** Read the bank emails since the configured date and sort them into new and duplicate transactions. */
export async function syncMail(e: Engine): Promise<MailSyncResult> {
  const p = getMailPrefs(e);
  if (!p.connected) throw new Error(tr('Conecta tu correo primero.'));
  const { invoke } = await import('@tauri-apps/api/core');
  const raw = await invoke<unknown[]>('mail_sync', { provider: p.provider, clientId: p.clientId, subject: p.subject, since: p.since });
  setSetting(e, CFG, { ...getSetting(e, CFG, {}), lastSync: new Date().toISOString() });
  const done = seen(e);
  const res: MailSyncResult = { read: raw.length, alreadyImported: 0, noAmount: 0, candidates: [] };
  const batch = new Set<string>();
  for (const m of raw) {
    const msg = p.provider === 'google' ? fromGmail(m as Parameters<typeof fromGmail>[0]) : fromGraph(m as Parameters<typeof fromGraph>[0]);
    const key = await sha(msg.id);
    if (done.has(key)) { res.alreadyImported++; continue; }
    const tx = parseBankEmail(msg);
    if (!tx) { res.noAmount++; continue; }
    // Two emails for the same purchase (same merchant, amount and day) count once.
    const sig = `${norm(tx.merchant)}|${tx.amount}|${tx.date}`;
    const duplicate = batch.has(sig) || alreadyRecorded(e, tx);
    batch.add(sig);
    res.candidates.push({ key, subject: msg.subject.slice(0, 120), tx, name: tx.merchant, duplicate });
  }
  res.candidates.sort((a, b) => b.tx.date.localeCompare(a.tx.date));
  return res;
}

/** Add the chosen (non-duplicate) transactions with the names the user gave them; each email only once. */
export function importMailTransactions(e: Engine, actor: Actor, list: MailCandidate[], accountId: string): number {
  if (!accountId) throw new Error(tr('Elige la cuenta donde se registran.'));
  const done = seen(e);
  const rules = getCategoryRules(e);
  let n = 0;
  e.transaction(() => {
    for (const c of list) {
      if (c.duplicate || done.has(c.key)) continue;
      const name = c.name.trim().slice(0, 120) || c.tx.merchant;
      createTransaction(e, actor, { type: c.tx.type, description: name, amount: c.tx.amount, currency: c.tx.currency, date: c.tx.date, accountId, categoryId: categoryFor(e, name, c.tx.type, rules), notes: tr('Importado de tu correo') });
      done.add(c.key);
      n++;
    }
    // shortcut: keeps the last 2000 fingerprints; enough for years of bank alerts.
    setSetting(e, SEEN, { items: [...done].slice(-2000) });
  });
  return n;
}

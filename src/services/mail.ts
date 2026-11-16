/** Import transactions from the user's bank notification emails (Gmail or Outlook), opt-in and desktop-only. */
import type { Engine } from '../db/engine';
import { isTauri } from '../db/adapters';
import { getSetting, setSetting } from '../db/repo/core';
import { createTransaction } from '../db/repo/finance';
import { assertCan } from '../domain/permissions';
import { fromGmail, fromGraph, parseBankEmail, type MailMessage, type ParsedTx } from '../domain/bankMail';
import type { Actor } from '../db/types';

export type MailProvider = 'google' | 'microsoft';
export interface MailConfig {
  provider: MailProvider;
  clientId: string;
  clientSecret: string;
  /** OAuth refresh token; kept in the local database (encrypted when the profile has a password). */
  refreshToken: string;
  subject: string;
  days: number;
  accountId: string;
  auto: boolean;
}
export interface MailCandidate { message: MailMessage; tx: ParsedTx }

const CFG = 'mailSync';
const SEEN = 'mailImported';
const EMPTY: MailConfig = { provider: 'google', clientId: '', clientSecret: '', refreshToken: '', subject: '', days: 30, accountId: '', auto: false };

export const mailSupported = () => isTauri();
export const getMailConfig = (e: Engine): MailConfig => getSetting<MailConfig>(e, CFG, EMPTY);
export function saveMailConfig(e: Engine, actor: Actor, patch: Partial<MailConfig>) {
  assertCan(actor.role, 'account.manage');
  setSetting(e, CFG, { ...getMailConfig(e), ...patch });
}
const seen = (e: Engine) => new Set(getSetting<{ items: string[] }>(e, SEEN, { items: [] }).items);

const b64url = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = (n: number) => b64url(crypto.getRandomValues(new Uint8Array(n)));

/** Sign in with the provider in the browser (PKCE) and remember the connection. */
export async function connectMail(e: Engine, actor: Actor, provider: MailProvider, clientId: string, clientSecret: string): Promise<void> {
  assertCan(actor.role, 'account.manage');
  const verifier = random(48);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const { invoke } = await import('@tauri-apps/api/core');
  const r = await invoke<{ refresh_token: string }>('mail_auth', { provider, clientId: clientId.trim(), clientSecret: clientSecret.trim() || null, challenge, verifier, state: random(16) });
  saveMailConfig(e, actor, { provider, clientId: clientId.trim(), clientSecret: clientSecret.trim(), refreshToken: r.refresh_token });
  await e.flush();
}

export function disconnectMail(e: Engine, actor: Actor) { saveMailConfig(e, actor, { refreshToken: '', auto: false }); }

/** Bank emails matching the subject that haven't been imported yet, read into transactions. */
export async function findMailTransactions(e: Engine): Promise<MailCandidate[]> {
  const c = getMailConfig(e);
  if (!c.refreshToken || !c.subject.trim()) return [];
  const { invoke } = await import('@tauri-apps/api/core');
  const r = await invoke<{ messages: unknown[]; refresh_token: string | null }>('mail_fetch', { provider: c.provider, clientId: c.clientId, clientSecret: c.clientSecret || null, refreshToken: c.refreshToken, subject: c.subject.trim(), days: c.days || 30 });
  if (r.refresh_token && r.refresh_token !== c.refreshToken) setSetting(e, CFG, { ...c, refreshToken: r.refresh_token });
  const done = seen(e);
  return r.messages
    .map((m) => (c.provider === 'google' ? fromGmail(m as Parameters<typeof fromGmail>[0]) : fromGraph(m as Parameters<typeof fromGraph>[0])))
    .filter((m) => !done.has(m.id))
    .flatMap((message) => { const tx = parseBankEmail(message); return tx ? [{ message, tx }] : []; });
}

/** Record the chosen emails as transactions in `accountId`; each email is imported only once. */
export function importMailTransactions(e: Engine, actor: Actor, list: MailCandidate[], accountId: string): number {
  if (!list.length) return 0;
  const done = seen(e);
  let n = 0;
  e.transaction(() => {
    for (const { message, tx } of list) {
      if (done.has(message.id)) continue;
      createTransaction(e, actor, { type: tx.type, description: tx.merchant, amount: tx.amount, currency: tx.currency, date: tx.date, accountId, notes: `${message.subject} · ${message.from}`.slice(0, 1000) });
      done.add(message.id);
      n++;
    }
    // shortcut: keeps the last 2000 imported ids; older emails fall outside any sensible search window anyway.
    setSetting(e, SEEN, { items: [...done].slice(-2000) });
  });
  return n;
}

/** On opening Monto: import new bank emails automatically when the user turned that on. */
export async function autoImportMail(e: Engine, actor: Actor): Promise<number> {
  const c = getMailConfig(e);
  if (!mailSupported() || !c.auto || !c.refreshToken || !c.accountId) return 0;
  return importMailTransactions(e, actor, await findMailTransactions(e), c.accountId);
}

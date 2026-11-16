/**
 * Optional: read transactions from the user's bank notification emails (Gmail or Outlook), desktop only.
 * Monto keeps no connection and no credentials: every search signs in again, the access token never
 * leaves the desktop side, and the client secret only lives in memory while the screen is open.
 */
import type { Engine } from '../db/engine';
import { isTauri } from '../db/adapters';
import { getSetting, setSetting } from '../db/repo/core';
import { createTransaction } from '../db/repo/finance';
import { assertCan } from '../domain/permissions';
import { categoryFor, getCategoryRules } from '../db/repo/rules';

import { fromGmail, fromGraph, parseBankEmail, type ParsedTx } from '../domain/bankMail';
import type { Actor } from '../db/types';
import { tr } from '../lib/i18n';

export type MailProvider = 'google' | 'microsoft';
/** Only non-secret preferences are stored (the client ID is a public identifier, not a credential). */
export interface MailPrefs { provider: MailProvider; clientId: string; subject: string; days: number; accountId: string }
/** A transaction read from one email; `key` is a fingerprint of the email id, used to import it only once. */
export interface MailCandidate { key: string; subject: string; tx: ParsedTx }

const CFG = 'mailSync';
const SEEN = 'mailImported';
const DEFAULTS: MailPrefs = { provider: 'google', clientId: '', subject: '', days: 30, accountId: '' };

export const mailSupported = () => isTauri();
export function getMailPrefs(e: Engine): MailPrefs {
  const c = getSetting<MailPrefs>(e, CFG, DEFAULTS);
  return { provider: c.provider, clientId: c.clientId, subject: c.subject, days: c.days, accountId: c.accountId };
}
export function saveMailPrefs(e: Engine, actor: Actor, patch: Partial<MailPrefs>) {
  assertCan(actor.role, 'account.manage');
  // Written field by field so nothing else (for example a token from an older build) is ever kept.
  const c = { ...getMailPrefs(e), ...patch };
  setSetting(e, CFG, { provider: c.provider, clientId: c.clientId.trim(), subject: c.subject.trim(), days: c.days, accountId: c.accountId });
}
const seen = (e: Engine) => new Set(getSetting<{ items: string[] }>(e, SEEN, { items: [] }).items);

const b64url = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = (n: number) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const sha = async (s: string) => b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))).slice(0, 22);

/**
 * Sign in (browser, PKCE), read the matching emails and return the new transactions found.
 * Email text is read in memory only; nothing from the email is stored except what the user imports.
 */
export async function readMailTransactions(e: Engine, prefs: MailPrefs, clientSecret: string): Promise<MailCandidate[]> {
  if (!prefs.clientId.trim() || !prefs.subject.trim()) throw new Error(tr('Indica el ID de cliente y el asunto.'));
  const verifier = random(48);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const { invoke } = await import('@tauri-apps/api/core');
  const raw = await invoke<unknown[]>('mail_read', {
    provider: prefs.provider, clientId: prefs.clientId.trim(), clientSecret: clientSecret.trim() || null,
    challenge, verifier, state: random(16), subject: prefs.subject.trim(), days: prefs.days || 30,
  });
  const done = seen(e);
  const out: MailCandidate[] = [];
  for (const m of raw) {
    const msg = prefs.provider === 'google' ? fromGmail(m as Parameters<typeof fromGmail>[0]) : fromGraph(m as Parameters<typeof fromGraph>[0]);
    const key = await sha(msg.id);
    if (done.has(key)) continue;
    const tx = parseBankEmail(msg);
    if (tx) out.push({ key, subject: msg.subject.slice(0, 120), tx });
  }
  return out;
}

/** Record the chosen transactions in `accountId`, with automatic categories; each email only once. */
export function importMailTransactions(e: Engine, actor: Actor, list: MailCandidate[], accountId: string): number {
  if (!list.length) return 0;
  const done = seen(e);
  const rules = getCategoryRules(e);
  let n = 0;
  e.transaction(() => {
    for (const { key, tx } of list) {
      if (done.has(key)) continue;
      createTransaction(e, actor, { type: tx.type, description: tx.merchant, amount: tx.amount, currency: tx.currency, date: tx.date, accountId, categoryId: categoryFor(e, tx.merchant, tx.type, rules), notes: tr('Importado de tu correo') });
      done.add(key);
      n++;
    }
    // shortcut: keeps the last 2000 fingerprints; older emails fall outside any sensible search window anyway.
    setSetting(e, SEEN, { items: [...done].slice(-2000) });
  });
  return n;
}

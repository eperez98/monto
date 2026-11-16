import { describe, expect, it, vi } from 'vitest';
import { freshEngine } from '../test/helpers';
import { createAccount, createTransaction, listTransactions } from '../db/repo/finance';

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const gmail = (id: string, day: number, text: string) => ({ id, internalDate: String(Date.UTC(2026, 10, day, 12)), payload: { headers: [{ name: 'Subject', value: 'Notificación de transacción' }], mimeType: 'text/plain', body: { data: b64(text) } } });
const messages = [
  gmail('a1', 14, 'Compra por B/. 45.80 en SUPER 99 VIA ESPANA el 14/11/2026.'),
  gmail('a2', 14, 'Compra por B/. 45.80 en SUPER 99 VIA ESPANA el 14/11/2026.'),
  gmail('b1', 15, 'Compra por B/. 12.00 en CAFE UNIDO.'),
  gmail('c1', 15, 'Tu estado de cuenta está listo.'),
];
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async (cmd: string) => (cmd === 'mail_sync' ? messages : undefined)) }));

describe('bank email sync', () => {
  it('flags duplicates by merchant and amount, lets the user rename, and imports each email once', async () => {
    const { saveMailPrefs, syncMail, importMailTransactions } = await import('./mail');
    const { e, actor } = await freshEngine();
    const acc = createAccount(e, actor, { name: 'Banco', type: 'checking', currency: 'PAB', initialBalance: 100000 });
    saveMailPrefs(e, actor, { provider: 'google', clientId: 'id', subject: 'Notificación de transacción', since: '2026-11-01', accountId: acc.id, connected: true });
    createTransaction(e, actor, { type: 'expense', description: 'Super 99 Via España', amount: 4580, currency: 'PAB', date: '2026-11-14', accountId: acc.id });

    const r = await syncMail(e);
    expect(r).toMatchObject({ read: 4, noAmount: 1, alreadyImported: 0 });
    expect(r.candidates.map((c) => [c.tx.merchant, c.duplicate])).toEqual([['CAFE UNIDO', false], ['SUPER 99 VIA ESPANA', true], ['SUPER 99 VIA ESPANA', true]]);

    const cafe = { ...r.candidates[0], name: 'Café con Ana' };
    expect(importMailTransactions(e, actor, [cafe, r.candidates[1]], acc.id)).toBe(1);
    expect(listTransactions(e, {}).some((t) => t.description === 'Café con Ana' && t.amount === 1200)).toBe(true);

    const again = await syncMail(e);
    expect(again.alreadyImported).toBe(1);
    expect(again.candidates.some((c) => c.tx.merchant === 'CAFE UNIDO')).toBe(false);
  });
});

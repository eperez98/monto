import { expect, it } from 'vitest';
import { freshEngine } from '../../test/helpers';
import { setProfile } from './core';
import { closeQuote, quotes, saveQuote, type QuoteDraft } from './quotes';

const draft: QuoteDraft = {
  company: 'Empresa de ejemplo', issuer: 'Ana Ejemplo', cedula: 'DEMO-1', ruc: '',
  bank: 'Banco de ejemplo', accountType: 'savings', account: '00001234',
  lines: [{ description: 'Diseño', cents: 12550 }],
};

it('preserves the agreed amount and ACH details in a single receipt', async () => {
  const { e, actor } = await freshEngine();
  saveQuote(e, actor, draft);
  const [{ id }] = quotes(e, actor);
  saveQuote(e, actor, { ...draft, lines: [{ description: 'Diseño final', cents: 15550 }] }, id);
  closeQuote(e, actor, id);
  const [paid] = quotes(e, actor);
  expect(paid.outcome).toMatchObject({ status: 'paid', receiptId: expect.any(String) });
  expect(paid.account).toBe('00001234');
  expect(paid.lines[0].cents).toBe(15550);
  expect(() => saveQuote(e, actor, draft, id)).toThrow();
  expect(() => closeQuote(e, actor, id)).toThrow();
  e.close();
});

it('requires a cancellation reason and isolates the issuer and country', async () => {
  const { e, actor } = await freshEngine();
  saveQuote(e, actor, draft);
  const [{ id }] = quotes(e, actor);
  expect(() => closeQuote(e, actor, id, ' ')).toThrow();
  closeQuote(e, actor, id, 'Cambio de alcance');
  expect(quotes(e, actor)[0].outcome).toEqual({ status: 'cancelled', reason: 'Cambio de alcance' });
  expect(() => closeQuote(e, actor, id)).toThrow();
  expect(quotes(e, { ...actor, id: 'otro' })).toEqual([]);
  setProfile(e, { country: 'CO' });
  expect(() => saveQuote(e, actor, draft)).toThrow();
  e.close();
});

import { expect, it } from 'vitest';
import { freshEngine } from '../../test/helpers';
import { setProfile, setSetting } from './core';
import {
  approveQuote,
  approvalEvidence,
  closeQuote,
  expires,
  installments,
  quoteTotal,
  quotes,
  saveQuote,
  type QuoteDraft,
} from './quotes';

const draft: QuoteDraft = {
  company: 'Empresa de ejemplo',
  issuer: 'Ana Ejemplo',
  cedula: 'DEMO-1',
  ruc: '',
  bank: 'Banco de ejemplo',
  accountType: 'savings',
  account: '00001234',
  phone: '+507 6000-0000',
  email: 'demo@example.com',
  terms: { kind: 'split', percent: 30 },
  lines: [{ description: 'Diseño', cents: 12550, basis: 'unit', hundredths: 100 }],
};

it('preserves the agreed amount and ACH details in a single receipt', async () => {
  const { e, actor } = await freshEngine();
  saveQuote(e, actor, draft);
  const [{ id }] = quotes(e, actor);
  saveQuote(
    e,
    actor,
    { ...draft, lines: [{ description: 'Diseño final', cents: 15550, basis: 'hour', hundredths: 125 }] },
    id,
  );
  expect(() => closeQuote(e, actor, id)).toThrow();
  expect(() => approveQuote(e, actor, id, new Uint8Array([0]))).toThrow();
  const proof = new TextEncoder().encode('%PDF-1.4\nsample');
  approveQuote(e, actor, id, proof);
  expect(approvalEvidence(e, actor, id).bytes).toEqual(proof);
  expect(() => saveQuote(e, actor, draft, id)).toThrow();
  closeQuote(e, actor, id);
  const [paid] = quotes(e, actor);
  expect(paid.outcome).toMatchObject({ status: 'paid', receiptId: expect.any(String) });
  expect(paid.account).toBe('00001234');
  expect(paid.lines[0].cents).toBe(15550);
  expect(quoteTotal(paid)).toBe(19438);
  expect(installments(quoteTotal(paid), draft.terms)).toEqual({ initial: 5831, final: 13607 });
  expect(() => saveQuote(e, actor, draft, id)).toThrow();
  expect(() => closeQuote(e, actor, id)).toThrow();
  e.close();
});

it('opens legacy quotes at quantity one and requires reissue after expiration', async () => {
  const { e, actor } = await freshEngine();
  setSetting(e, 'quotes:' + actor.id, {
    items: [
      {
        ...draft,
        lines: [{ description: 'Original', cents: 5010 }],
        id: 'legacy',
        date: '2024-01-25',
        outcome: { status: 'open' },
      },
    ],
  });
  const [q] = quotes(e, actor);
  expect(quoteTotal(q)).toBe(5010);
  expect(expires(q)).toBe('2024-02-09');
  expect(() => approveQuote(e, actor, q.id, new TextEncoder().encode('%PDF-'))).toThrow();
  saveQuote(e, actor, draft, q.id);
  expect(expires(quotes(e, actor)[0]) > expires(q)).toBe(true);
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

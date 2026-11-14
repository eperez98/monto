import { describe, expect, it } from 'vitest';
import { freshEngine } from '../test/helpers';
import { createAccount, getAccount } from './repo/finance';
import { createIncomeSource, incomeSummary, listReceived, markPaymentReceived, removeIncomeAck } from './repo/planning';
import { addDays, today } from '../lib/dates';

describe('salary received without adding to the balance', () => {
  it('counts the pay date as received but leaves the opening balance alone, and can be undone', async () => {
    const { e, actor } = await freshEngine();
    const acc = createAccount(e, actor, { name: 'Banco', type: 'savings', currency: 'PAB', initialBalance: 160000, ownerMemberId: actor.id });
    const src = createIncomeSource(e, actor, { name: 'Empresa', currency: 'PAB', accountId: acc.id, startDate: addDays(today(), -40), config: { frequency: 'semimonthly', amount1: 150000, sameAmount: true, payDay1: 15, payDay2: 30 } });
    const before = incomeSummary(e, src);
    expect(before.pending.length).toBeGreaterThan(0);
    const occ = before.pending[0];

    expect(markPaymentReceived(e, actor, src, occ, { addToBalance: false })).toBeNull();
    expect(getAccount(e, acc.id)!.balance).toBe(160000);
    expect(incomeSummary(e, src).pending.map((p) => p.periodKey)).not.toContain(occ.periodKey);
    expect(listReceived(e, src.id)[0]).toMatchObject({ ack: { periodKey: occ.periodKey, amount: 150000 } });
    expect(() => markPaymentReceived(e, actor, src, occ)).toThrow();

    removeIncomeAck(e, actor, src.id, occ.periodKey);
    expect(incomeSummary(e, src).pending.map((p) => p.periodKey)).toContain(occ.periodKey);
    markPaymentReceived(e, actor, src, occ);
    expect(getAccount(e, acc.id)!.balance).toBe(310000);
    expect('tx' in listReceived(e, src.id)[0]).toBe(true);
  });
});

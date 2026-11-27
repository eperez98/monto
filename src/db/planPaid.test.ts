import { describe, expect, it } from 'vitest';
import { freshEngine } from '../test/helpers';
import { createAccount, getAccount, listTransactions } from './repo/finance';
import { getExpensePlan, getPlanPaid, saveExpensePlan, setPlanPaid } from './repo/planning';

describe('plan bills paid this month', () => {
  it('keeps monthly lists and payments separate while preserving the legacy plan', async () => {
    const { e, actor } = await freshEngine();
    const bill = { name: 'Electricidad', amount: 4500 };
    e.run('INSERT INTO settings (key, value) VALUES (?, ?)', [
      `expensePlan:${actor.id}`, JSON.stringify({ items: [bill] }),
    ]);
    const november = '2026-11';
    const december = '2026-12';
    saveExpensePlan(e, actor, [{ ...bill, amount: 5100 }], actor.id, november);
    setPlanPaid(e, actor, bill, { paid: true, deduct: false, month: november });
    expect(getExpensePlan(e, actor.id, november)).toEqual([{ ...bill, amount: 5100 }]);
    expect(getExpensePlan(e, actor.id, december)).toEqual([bill]);
    expect(getPlanPaid(e, actor.id, december)).toEqual({});
    saveExpensePlan(e, actor, [], actor.id, december);
    expect(getExpensePlan(e, actor.id, december)).toEqual([]);
    expect(getPlanPaid(e, actor.id, november).Electricidad?.paid).toBe(true);
  });

  it('only lowers the balance when the user chooses to subtract the payment', async () => {
    const { e, actor } = await freshEngine();
    const acc = createAccount(e, actor, { name: 'Banco', type: 'savings', currency: 'PAB', initialBalance: 100000, ownerMemberId: actor.id });
    const luz = { name: 'Electricidad', amount: 4500, dueDay: 5 };
    const month = '2026-11';

    setPlanPaid(e, actor, luz, { paid: true, deduct: false, month });
    expect(getPlanPaid(e, actor.id, month).Electricidad).toEqual({ paid: true, txId: undefined });
    expect(getAccount(e, acc.id)!.balance).toBe(100000);

    setPlanPaid(e, actor, luz, { paid: true, deduct: true, month, date: '2026-11-05' });
    expect(getAccount(e, acc.id)!.balance).toBe(95500);
    expect(listTransactions(e, {}).some((t) => t.description === 'Electricidad')).toBe(true);

    setPlanPaid(e, actor, luz, { paid: true, deduct: false, month });
    expect(getAccount(e, acc.id)!.balance).toBe(100000);

    setPlanPaid(e, actor, luz, { paid: true, deduct: true, month });
    setPlanPaid(e, actor, luz, { paid: false, deduct: true, month });
    expect(getPlanPaid(e, actor.id, month)).toEqual({});
    expect(getAccount(e, acc.id)!.balance).toBe(100000);
  });
});

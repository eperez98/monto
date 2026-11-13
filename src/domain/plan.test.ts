import { describe, expect, it } from 'vitest';
import { paymentOrder, planSummary } from './plan';

describe('planSummary', () => {
  it('subtracts expenses from income and reports what can be saved', () => {
    const s = planSummary(300000, [{ name: 'Alquiler', amount: 90000 }, { name: 'Comida', amount: 60000 }]);
    expect(s).toEqual({ income: 300000, expenses: 150000, remaining: 150000, canSave: 150000, savingsRate: 50 });
  });

  it('reports a deficit with nothing to save', () => {
    const s = planSummary(100000, [{ name: 'Alquiler', amount: 120000 }]);
    expect(s.remaining).toBe(-20000);
    expect(s.canSave).toBe(0);
    expect(s.savingsRate).toBe(0);
  });

  it('ignores negative amounts and handles no income', () => {
    expect(planSummary(0, [{ name: 'x', amount: -500 }])).toMatchObject({ expenses: 0, remaining: 0, canSave: 0, savingsRate: 0 });
  });
});

describe('paymentOrder', () => {
  it('orders bills by how soon they fall due after a monthly payday and tracks what is left', () => {
    const steps = paymentOrder(100000, 30, [
      { name: 'Luz', amount: 10000, dueDay: 15 },
      { name: 'Alquiler', amount: 60000, dueDay: 5 },
      { name: 'Comida', amount: 20000 },
      { name: 'Tarjeta', amount: 30000, dueDay: 30 },
    ]);
    expect(steps.map((s) => s.name)).toEqual(['Comida', 'Tarjeta', 'Alquiler', 'Luz']);
    expect(steps.map((s) => s.offset)).toEqual([0, 0, 6, 16]);
    expect(steps.map((s) => s.balanceAfter)).toEqual([80000, 50000, -10000, -20000]);
    expect(steps.map((s) => s.short)).toEqual([false, false, true, true]);
  });
});

import { describe, expect, it } from 'vitest';
import { billsDueSoon } from './billAlerts';

describe('bill reminders', () => {
  const items = [
    { name: 'Luz', amount: 4500, dueDay: 16 },
    { name: 'Agua', amount: 1500, dueDay: 15 },
    { name: 'Alquiler', amount: 90000, dueDay: 5 },
    { name: 'Comida', amount: 30000 },
    { name: 'Internet', amount: 3000, dueDay: 31 },
  ];
  it('lists unpaid bills due today or within two days, soonest first', () => {
    expect(billsDueSoon(items, {}, '2026-11-15')).toEqual([{ name: 'Agua', amount: 1500, inDays: 0 }, { name: 'Luz', amount: 4500, inDays: 1 }]);
    expect(billsDueSoon(items, { Agua: { paid: true } }, '2026-11-15').map((b) => b.name)).toEqual(['Luz']);
  });
  it('wraps to next month and treats day 31 as the last day', () => {
    expect(billsDueSoon(items, {}, '2026-11-29').map((b) => b.name)).toEqual(['Internet']);
    expect(billsDueSoon(items, {}, '2026-11-04').map((b) => b.name)).toEqual(['Alquiler']);
  });
});

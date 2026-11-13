/** Monthly expense plan: fixed monthly expenses vs. the member's net monthly income (all in cents). */
export interface PlanItem { name: string; amount: number; /** Day of the month the bill is due (1-31). */ dueDay?: number }

export interface PlanSummary {
  income: number;
  expenses: number;
  /** Income left after expenses; negative means a monthly deficit. */
  remaining: number;
  /** What could go to savings each month (0 when there is no surplus). */
  canSave: number;
  /** Share of income that `canSave` represents (0-100). */
  savingsRate: number;
}

export function planSummary(income: number, items: PlanItem[]): PlanSummary {
  const expenses = items.reduce((a, i) => a + Math.max(0, i.amount), 0);
  const remaining = income - expenses;
  const canSave = Math.max(0, remaining);
  return { income, expenses, remaining, canSave, savingsRate: income > 0 ? (canSave / income) * 100 : 0 };
}

export interface PayStep extends PlanItem {
  /** Days after payday the bill is due (0 = pay on payday). */
  offset: number;
  /** Money left after paying this and every earlier bill. */
  balanceAfter: number;
  /** True when the salary no longer covers this bill. */
  short: boolean;
}

/**
 * Order to pay the month's bills for someone paid once a month: by how soon each falls due after payday
 * (bills with no due day first), with the money left after each one.
 */
export function paymentOrder(income: number, payDay: number, items: PlanItem[]): PayStep[] {
  // shortcut: treats every month as 31 days, so a bill due on the 31st in a 30-day month sorts one day late.
  const offset = (d?: number) => (d ? (d - payDay + 31) % 31 : 0);
  let left = income;
  return items
    .filter((i) => i.amount > 0)
    .map((i, k) => ({ i, k, o: offset(i.dueDay) }))
    .sort((a, b) => a.o - b.o || a.k - b.k)
    .map(({ i, o }) => { left -= i.amount; return { ...i, offset: o, balanceAfter: left, short: left < 0 }; });
}

/** "Tu mes en resumen": the numbers of a closed month, turned into a short visual story. */
export interface MonthRecapInput {
  income: number; expense: number; prevIncome: number; prevExpense: number;
  cats: Array<{ name: string; color: string; amount: number }>;
  biggest: { description: string; amount: number; date: string } | null;
  count: number;
}
export interface MonthRecap {
  saved: number; rate: number | null; verdict: 'saved' | 'even' | 'overspent' | 'empty';
  /** Spending vs the month before, in %; null when there is nothing to compare. */
  expenseChange: number | null;
  top: Array<{ name: string; color: string; amount: number; share: number }>;
  biggest: MonthRecapInput['biggest']; count: number; income: number; expense: number;
}

export function buildMonthRecap(i: MonthRecapInput): MonthRecap {
  const saved = i.income - i.expense;
  const total = i.cats.reduce((a, c) => a + Math.max(0, c.amount), 0);
  return {
    saved,
    rate: i.income > 0 ? Math.round((saved / i.income) * 100) : null,
    verdict: i.count === 0 ? 'empty' : saved > 0 ? 'saved' : saved === 0 ? 'even' : 'overspent',
    expenseChange: i.prevExpense > 0 ? Math.round(((i.expense - i.prevExpense) / i.prevExpense) * 100) : null,
    top: [...i.cats].filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 3).map((c) => ({ ...c, share: total ? Math.round((c.amount / total) * 100) : 0 })),
    biggest: i.biggest, count: i.count, income: i.income, expense: i.expense,
  };
}

/** The recap of last month shows on the summary during the first days of the new one. */
export const showRecapCard = (dayOfMonth: number) => dayOfMonth <= 10;

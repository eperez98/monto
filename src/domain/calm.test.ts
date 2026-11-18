import { describe, expect, it } from 'vitest';
import { moveCard, resolveCards, DASH_CARDS } from './dashboardCards';
import { buildMonthRecap, showRecapCard } from './monthRecap';

describe('dashboard cards', () => {
  it('keeps the saved order, drops unknown or repeated cards and appends new ones', () => {
    const r = resolveCards([{ key: 'chart', on: false }, { key: 'nope', on: true }, { key: 'chart', on: true }, { key: 'balances', on: true }]);
    expect(r.slice(0, 2)).toEqual([{ key: 'chart', on: false }, { key: 'balances', on: true }]);
    expect(r.map((c) => c.key).sort()).toEqual([...DASH_CARDS].sort());
    expect(resolveCards(undefined).every((c) => c.on)).toBe(true);
  });
  it('moves a card up or down and ignores moves past the ends', () => {
    const list = resolveCards();
    expect(moveCard(list, 1, -1).map((c) => c.key).slice(0, 2)).toEqual([list[1].key, list[0].key]);
    expect(moveCard(list, 0, -1)).toBe(list);
  });
});

describe('month recap', () => {
  const base = { prevIncome: 0, biggest: null, count: 5 };
  it('says how much was saved, the change in spending and the top 3 categories', () => {
    const r = buildMonthRecap({ ...base, income: 300000, expense: 240000, prevExpense: 200000, cats: [{ name: 'A', color: '#1', amount: 120000 }, { name: 'B', color: '#2', amount: 60000 }, { name: 'C', color: '#3', amount: 40000 }, { name: 'D', color: '#4', amount: 20000 }] });
    expect(r).toMatchObject({ saved: 60000, rate: 20, verdict: 'saved', expenseChange: 20 });
    expect(r.top.map((c) => [c.name, c.share])).toEqual([['A', 50], ['B', 25], ['C', 17]]);
  });
  it('handles months with no income or nothing recorded', () => {
    expect(buildMonthRecap({ ...base, income: 0, expense: 5000, prevExpense: 0, cats: [] })).toMatchObject({ rate: null, verdict: 'overspent', expenseChange: null });
    expect(buildMonthRecap({ ...base, count: 0, income: 0, expense: 0, prevExpense: 0, cats: [] }).verdict).toBe('empty');
    expect([showRecapCard(1), showRecapCard(10), showRecapCard(11)]).toEqual([true, true, false]);
  });
});

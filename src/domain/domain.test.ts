import { describe, expect, it } from 'vitest';
import { amortizationSchedule, applyPayments, monthlyPayment, monthsToPayoff } from './amortization';
import { budgetStatus } from './budget';
import { can, canEditTransaction } from './permissions';
import { occurrences } from './recurrence';
import { netBalances, simplifyDebts, splitEqually } from './split';
import { findDuplicates, highSpendCategories, monthsToGoal, projectSavings, savingsRate } from './insights';
import { amountInSql, combined, convert, formatMoney, parseMoney, setRates } from '../lib/money';
import { periodRange, previousRange } from '../lib/dates';

describe('money', () => {
  it('formats PAB and USD distinctly', () => {
    expect(formatMoney(150000, 'PAB')).toBe('B/. 1,500.00');
    expect(formatMoney(150000, 'USD')).toBe('$1,500.00');
    expect(formatMoney(-2550, 'USD')).toBe('−$25.50');
  });
  it('parses user input', () => {
    expect(parseMoney('1,500.50')).toBe(150050);
    expect(parseMoney('B/. 20')).toBe(2000);
    expect(parseMoney('abc')).toBeNaN();
    expect(parseMoney('1.23.4')).toBeNaN();
  });
  it('reads and writes Colombian pesos', () => {
    expect(parseMoney('1.234')).toBe(123400);
    expect(parseMoney('$ 45.000')).toBe(4500000);
    expect(parseMoney('45.000,50')).toBe(4500050);
    expect(parseMoney('12,5')).toBe(1250);
    expect(formatMoney(4500000, 'COP')).toBe('$ 45.000');
    expect(formatMoney(4500050, 'COP')).toBe('$ 45.000,5');
    setRates({ COP: 4000 });
    // US$ 15.00 at 4 000 pesos each, plus $ 90 in pesos.
    expect(combined({ PAB: 1000, USD: 500, COP: 9000 }, 'COP')).toBe(6009000);
    expect(combined({ PAB: 1000, USD: 500, COP: 400000 }, 'PAB')).toBe(1600);
  });
  it('converts at the rate the user sets, and keeps balboa and dollar at par', () => {
    setRates({ COP: 3900, CRC: 500, DOP: 60, PAB: 2 });
    expect(convert(10000, 'USD', 'COP')).toBe(39000000);
    expect(convert(39000000, 'COP', 'USD')).toBe(10000);
    expect(convert(5000, 'CRC', 'DOP')).toBe(600);
    expect(convert(100, 'PAB', 'USD')).toBe(100);
    expect(amountInSql('COP')).toContain("WHEN 'USD' THEN amount * 3900");
    setRates({ COP: -5 });
    expect(convert(100, 'USD', 'COP')).toBe(400000);
    setRates(undefined);
  });
  it('writes colones and Dominican pesos the local way', () => {
    expect(formatMoney(1250000, 'CRC')).toMatch(/^₡ 12\s500$/);
    expect(formatMoney(125050, 'DOP')).toBe('RD$ 1,250.50');
    expect(parseMoney('RD$ 1,250.50')).toBe(125050);
    expect(parseMoney('₡ 12500')).toBe(1250000);
  });
  it('PAB:USD parity is 1:1', () => {
    expect(convert(12345, 'PAB', 'USD')).toBe(12345);
    expect(combined({ PAB: 1000, USD: 500 })).toBe(1500);
  });
});

describe('periods', () => {
  it('month / quarter / previous', () => {
    expect(periodRange('month', '2026-11-06')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(periodRange('quarter', '2026-11-06')).toEqual({ from: '2026-10-01', to: '2026-12-31' });
    expect(previousRange('month', { from: '2026-03-01', to: '2026-03-31' })).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(periodRange('week', '2026-11-06')).toEqual({ from: '2026-11-02', to: '2026-11-08' });
  });
});

describe('amortization', () => {
  it('computes French installment', () => {
    // 10,000 at 12 % for 12 months ≈ 888.49
    expect(monthlyPayment(1000000, 12, 12)).toBe(88849);
    const s = amortizationSchedule(1000000, 12, 12, '2026-01-15');
    expect(s).toHaveLength(12);
    expect(s.at(-1)!.balance).toBe(0);
    expect(s[0].interest).toBe(10000);
  });
  it('applies real payments', () => {
    const st = applyPayments(1000000, 12, [{ date: '2026-01-15', amount: 88849 }]);
    expect(st.paidInterest).toBe(10000);
    expect(st.balance).toBe(1000000 - 78849);
  });
  it('zero-rate loans and payoff months', () => {
    expect(monthlyPayment(120000, 0, 12)).toBe(10000);
    expect(monthsToPayoff(120000, 0, 10000)).toBe(12);
    expect(monthsToPayoff(100000, 24, 1000)).toBe(Infinity);
  });
});

describe('budgets', () => {
  it('alerts at 70/90/100 %', () => {
    expect(budgetStatus(10000, 6900).level).toBe('ok');
    expect(budgetStatus(10000, 7000).level).toBe('notice');
    expect(budgetStatus(10000, 9000).level).toBe('warning');
    expect(budgetStatus(10000, 10000).level).toBe('exceeded');
    expect(budgetStatus(10000, 2500).available).toBe(7500);
  });
});

describe('permissions', () => {
  it('role matrix', () => {
    expect(can('admin', 'member.manage')).toBe(true);
    expect(can('adult', 'member.manage')).toBe(false);
    expect(can('adult', 'budget.manage')).toBe(true);
    expect(can('member', 'budget.manage')).toBe(false);
    expect(can('member', 'tx.create')).toBe(true);
    expect(can('readonly', 'tx.create')).toBe(false);
    expect(can('readonly', 'view')).toBe(true);
  });
  it('members only edit their own transactions', () => {
    expect(canEditTransaction('member', 'a', 'a')).toBe(true);
    expect(canEditTransaction('member', 'a', 'b')).toBe(false);
    expect(canEditTransaction('adult', 'a', 'b')).toBe(true);
    expect(canEditTransaction('readonly', 'a', 'a')).toBe(false);
  });
});

describe('recurrence', () => {
  it('monthly on day 31 clamps', () => {
    expect(occurrences({ frequency: 'monthly', startDate: '2026-01-31' }, '2026-01-01', '2026-04-30')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });
  it('respects end date', () => {
    expect(occurrences({ frequency: 'weekly', startDate: '2026-11-02', endDate: '2026-11-16' }, '2026-11-01', '2026-12-31')).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
  });
});

describe('family split', () => {
  it('computes who owes whom and settlements', () => {
    const net = netBalances(
      [{ payerId: 'ana', shares: splitEqually(9000, ['ana', 'luis', 'eva']) }],
      [{ fromId: 'luis', toId: 'ana', amount: 3000 }],
    );
    expect(net.get('ana')).toBe(3000);
    expect(net.get('luis')).toBe(0);
    expect(simplifyDebts(net)).toEqual([{ fromId: 'eva', toId: 'ana', amount: 3000 }]);
  });
  it('splits cents fairly', () => expect(splitEqually(1000, ['a', 'b', 'c']).map((s) => s.amount)).toEqual([334, 333, 333]));
});

describe('insights', () => {
  it('detects duplicates', () => {
    const d = findDuplicates([
      { id: '1', type: 'expense', description: 'Super 99', amount: 4520, date: '2026-11-01', accountId: 'a', categoryId: 'c' },
      { id: '2', type: 'expense', description: 'SUPER 99 ', amount: 4520, date: '2026-11-02', accountId: 'a', categoryId: 'c' },
      { id: '3', type: 'expense', description: 'Super 99', amount: 4520, date: '2026-11-09', accountId: 'a', categoryId: 'c' },
    ]);
    expect(d.map(([a, b]) => [a.id, b.id])).toEqual([['1', '2']]);
  });
  it('flags high spend categories', () => {
    const r = highSpendCategories(new Map([['food', 30000], ['fun', 5000]]), new Map([['food', [20000, 20000]], ['fun', [5000]]]));
    expect(r).toHaveLength(1);
    expect(r[0].changePct).toBe(50);
  });
  it('projections', () => {
    expect(projectSavings([10000, 20000, 30000]).projected12).toBe(240000);
    expect(monthsToGoal(100000, 30000)).toBe(4);
    expect(savingsRate(300000, 240000)).toBe(20);
  });
});

import { describe, expect, it } from 'vitest';
import { detectSubscriptions, merchantKey, type SubTx } from './subscriptions';

let n = 0;
const tx = (description: string, amount: number, date: string, extra: Partial<SubTx> = {}): SubTx => ({ id: String(n++), type: 'expense', description, amount, currency: 'USD', date, accountId: 'a', categoryId: null, recurringId: null, ...extra });

describe('subscriptions found in movements', () => {
  it('groups bank descriptions of the same merchant', () => {
    expect(merchantKey('NETFLIX.COM 8823 PANAMA')).toBe(merchantKey('Netflix.com'.padEnd(12) + ' 1 panama'));
    expect(merchantKey('Spotify P1A2B3')).toBe('spotify');
  });

  it('finds a monthly subscription with small price changes and a weekly one', () => {
    const txs = [
      tx('NETFLIX.COM 001', 1549, '2026-08-05'), tx('NETFLIX.COM 002', 1549, '2026-09-05'), tx('NETFLIX.COM 003', 1599, '2026-10-06'), tx('NETFLIX.COM 004', 1599, '2026-11-05'),
      tx('LAVADO EXPRESS', 500, '2026-10-24'), tx('LAVADO EXPRESS', 500, '2026-10-31'), tx('LAVADO EXPRESS', 550, '2026-11-07'), tx('LAVADO EXPRESS', 500, '2026-11-14'),
    ];
    const found = detectSubscriptions(txs, '2026-11-18');
    expect(found.map((s) => [s.key, s.frequency, s.count])).toEqual([['lavado express', 'weekly', 4], ['netflix com', 'monthly', 4]]);
    expect(found.find((s) => s.frequency === 'monthly')).toMatchObject({ amount: 1599, nextDate: '2026-12-05' });
  });

  it('ignores irregular spending, stopped subscriptions, ones already programmed and dismissed ones', () => {
    const txs = [
      tx('SUPER 99', 4580, '2026-09-02'), tx('SUPER 99', 1200, '2026-09-20'), tx('SUPER 99', 8000, '2026-10-30'),
      tx('GIMNASIO FIT', 3000, '2026-03-01'), tx('GIMNASIO FIT', 3000, '2026-04-01'), tx('GIMNASIO FIT', 3000, '2026-05-01'),
      tx('INTERNET CABLE', 4500, '2026-09-10'), tx('INTERNET CABLE', 4500, '2026-10-10'), tx('INTERNET CABLE', 4500, '2026-11-10'),
      tx('DISNEY PLUS', 899, '2026-09-12'), tx('DISNEY PLUS', 899, '2026-10-12'), tx('DISNEY PLUS', 899, '2026-11-12'),
      tx('ICLOUD', 99, '2026-09-01', { recurringId: 'r1' }), tx('ICLOUD', 99, '2026-10-01', { recurringId: 'r1' }), tx('ICLOUD', 99, '2026-11-01', { recurringId: 'r1' }),
    ];
    expect(detectSubscriptions(txs, '2026-11-18', ['Internet cable'], ['disney plus'])).toEqual([]);
  });

  it('needs two yearly payments about a year apart', () => {
    const found = detectSubscriptions([tx('DOMINIO WEB', 1500, '2025-11-01'), tx('DOMINIO WEB', 1500, '2026-11-02')], '2026-11-18');
    expect(found[0]).toMatchObject({ frequency: 'yearly', monthly: 125 });
  });
});

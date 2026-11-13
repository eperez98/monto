import { describe, expect, it } from 'vitest';
import { buildStories, dailyAllowance } from './overview';

describe('dailyAllowance', () => {
  it('splits balance minus pending bills over the days left', () => {
    expect(dailyAllowance(100000, 40000, 10)).toBe(6000);
    expect(dailyAllowance(10000, 40000, 10)).toBe(0);
    expect(dailyAllowance(5000, 0, 0)).toBe(5000);
  });
});

describe('buildStories', () => {
  const base = { currency: 'PAB' as const, income: 0, expense: 0, cats: [], prevCats: [], bills: [], goals: [], alerts: [], hasTransactions: true };

  it('puts a bill due soon first, then savings, category change and goal', () => {
    const s = buildStories({
      ...base, income: 100000, expense: 80000,
      cats: [{ categoryId: 'f', name: 'Comida', amount: 8800 }], prevCats: [{ categoryId: 'f', name: 'Comida', amount: 10000 }],
      bills: [{ title: 'Luz', amount: 4500, currency: 'PAB', inDays: 1 }],
      goals: [{ name: 'Emergencia', saved: 70000, target: 100000, currency: 'PAB' }],
    });
    expect(s.map((x) => x.key)).toEqual(['bill', 'save', 'cat', 'goal']);
    expect(s[0].text).toContain('mañana');
    expect(s[1].text).toContain('20 %');
    expect(s[2].text).toContain('12 % menos en Comida');
    expect(s[3].text).toContain('300.00');
  });

  it('warns about overspending and invites a first record when empty', () => {
    expect(buildStories({ ...base, income: 1000, expense: 1500 }).map((x) => x.key)).toEqual(['over']);
    expect(buildStories({ ...base, hasTransactions: false })[0]).toMatchObject({ key: 'start', action: { to: 'newTx' } });
  });

  it('ignores bills more than a week away and keeps at most four', () => {
    const s = buildStories({ ...base, income: 1000, expense: 500, bills: [{ title: 'Seguro', amount: 1, currency: 'PAB', inDays: 20 }], alerts: [{ title: 'A' }], goals: [{ name: 'G', saved: 0, target: 10, currency: 'PAB' }] });
    expect(s.some((x) => x.key === 'bill')).toBe(false);
    expect(s.length).toBeLessThanOrEqual(4);
  });
});

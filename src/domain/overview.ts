/** Plain-language summaries for the "Hoy" and "Historias" dashboard styles (all amounts in cents). */
import { formatMoney, type Currency } from '../lib/money';
import { tr } from '../lib/i18n';

/** What can be spent per day for the rest of the month: balance minus bills still due, split over the days left. */
export function dailyAllowance(available: number, dueThisMonth: number, daysLeft: number): number {
  return Math.max(0, Math.floor((available - dueThisMonth) / Math.max(1, daysLeft)));
}

export type StoryRoute = 'calendar' | 'reports' | 'goals' | 'budgets' | 'insights' | 'newTx';
export interface Story { key: string; tone: 'good' | 'warn' | 'info'; text: string; action: { label: string; to: StoryRoute } }

export interface StoryInput {
  currency: Currency;
  income: number;
  expense: number;
  /** Expenses by category for this period and the previous one. */
  cats: Array<{ categoryId: string; name: string; amount: number }>;
  prevCats: Array<{ categoryId: string; name: string; amount: number }>;
  /** Unpaid bills, soonest first, with days until due. */
  bills: Array<{ title: string; amount: number; currency: Currency; inDays: number }>;
  goals: Array<{ name: string; saved: number; target: number; currency: Currency }>;
  alerts: Array<{ title: string }>;
  hasTransactions: boolean;
}

/** Up to four short messages, most important first. */
export function buildStories(d: StoryInput): Story[] {
  const m = (c: number, cur: Currency = d.currency) => formatMoney(c, cur);
  const out: Story[] = [];
  if (!d.hasTransactions) {
    out.push({ key: 'start', tone: 'info', text: tr('Registra tu primer gasto o ingreso y aquí verás cómo va tu mes.'), action: { label: tr('Registrar'), to: 'newTx' } });
  }
  const bill = d.bills.find((b) => b.inDays <= 7);
  if (bill) {
    const when = bill.inDays <= 0 ? tr('hoy') : bill.inDays === 1 ? tr('mañana') : tr('en {n} días', { n: bill.inDays });
    out.push({ key: 'bill', tone: 'warn', text: tr('{title} vence {when}: {amount}.', { title: bill.title, when, amount: m(bill.amount, bill.currency) }), action: { label: tr('Ver calendario'), to: 'calendar' } });
  }
  if (d.income > 0 && d.expense > d.income) {
    out.push({ key: 'over', tone: 'warn', text: tr('Este periodo gastas más de lo que ingresas: {amount} de diferencia.', { amount: m(d.expense - d.income) }), action: { label: tr('Ver presupuestos'), to: 'budgets' } });
  } else if (d.income > 0) {
    const pct = Math.round(((d.income - d.expense) / d.income) * 100);
    out.push({ key: 'save', tone: 'good', text: tr('Llevas ahorrado el {pct} % de tus ingresos este periodo.', { pct }), action: { label: tr('Ver análisis'), to: 'insights' } });
  }
  // Biggest category change vs the previous period (at least 10 %).
  let best: { name: string; delta: number } | null = null;
  for (const p of d.prevCats) {
    if (p.amount <= 0) continue;
    const cur = d.cats.find((c) => c.categoryId === p.categoryId)?.amount ?? 0;
    const delta = Math.round(((cur - p.amount) / p.amount) * 100);
    if (Math.abs(delta) >= 10 && (!best || Math.abs(delta) > Math.abs(best.delta))) best = { name: p.name, delta };
  }
  if (best) {
    out.push(best.delta < 0
      ? { key: 'cat', tone: 'good', text: tr('Gastaste {pct} % menos en {cat} que el periodo anterior.', { pct: -best.delta, cat: best.name }), action: { label: tr('Ver informes'), to: 'reports' } }
      : { key: 'cat', tone: 'warn', text: tr('Gastaste {pct} % más en {cat} que el periodo anterior.', { pct: best.delta, cat: best.name }), action: { label: tr('Ver informes'), to: 'reports' } });
  }
  const goal = d.goals.find((g) => g.target > g.saved);
  if (goal) out.push({ key: 'goal', tone: 'info', text: tr('Te faltan {amount} para «{goal}».', { amount: m(goal.target - goal.saved, goal.currency), goal: goal.name }), action: { label: tr('Ver objetivos'), to: 'goals' } });
  if (d.alerts[0]) out.push({ key: 'alert', tone: 'warn', text: d.alerts[0].title, action: { label: tr('Ver presupuestos'), to: 'budgets' } });
  return out.slice(0, 4);
}

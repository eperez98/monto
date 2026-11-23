/**
 * Subscriptions and payments that repeat, found in the movements themselves: the same merchant, a similar amount and a
 * steady rhythm (weekly, every two weeks, monthly, quarterly or yearly). Only real history; nothing is guessed.
 */
import { addDays, addMonths, diffDays, type ISODate } from '../lib/dates';
import type { Currency } from '../lib/money';
import type { RecurFrequency } from './recurrence';
import { monthlyEquivalent } from './recurrence';

export interface SubTx { id: string; type: string; description: string; amount: number; currency: Currency; date: ISODate; accountId: string | null; categoryId: string | null; recurringId: string | null }
export interface DetectedSubscription {
  key: string; description: string; amount: number; currency: Currency; accountId: string | null; categoryId: string | null;
  frequency: RecurFrequency; count: number; lastDate: ISODate; nextDate: ISODate; monthly: number;
}

/** The merchant part of a bank description: "NETFLIX.COM 8823 PANAMA" and "Netflix.com" give the same key. */
export function merchantKey(description: string): string {
  return description.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\d+/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
    .split(' ').filter((w) => w.length > 1).slice(0, 3).join(' ');
}

const RHYTHMS: Array<[RecurFrequency, number, number]> = [['weekly', 6, 8], ['biweekly', 13, 16], ['monthly', 27, 33], ['quarterly', 85, 95], ['yearly', 350, 380]];
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
/** Monthly-type payments fall on the same day of the month; weekly ones every 7 or 14 days. */
const next = (d: ISODate, f: RecurFrequency) => (f === 'weekly' ? addDays(d, 7) : f === 'biweekly' ? addDays(d, 14) : addMonths(d, f === 'monthly' ? 1 : f === 'quarterly' ? 3 : 12));
const PERIOD: Record<RecurFrequency, number> = { weekly: 7, biweekly: 14, monthly: 30, quarterly: 91, yearly: 365 };

/**
 * `known`: descriptions already programmed as recurring payments (left out). `ignored`: merchant keys the user
 * dismissed. A pattern needs 3 payments (2 for yearly ones), every gap close to the same rhythm, amounts within 15 %,
 * and the latest payment recent enough that the next one is still expected.
 */
export function detectSubscriptions(txs: SubTx[], ref: ISODate, known: string[] = [], ignored: string[] = []): DetectedSubscription[] {
  const skip = new Set([...known.map(merchantKey), ...ignored]);
  const groups = new Map<string, SubTx[]>();
  for (const t of txs) {
    if (t.type !== 'expense' || t.recurringId || t.date > ref || diffDays(ref, t.date) > 800) continue;
    const k = merchantKey(t.description);
    if (k.length < 3 || skip.has(k)) continue;
    const g = `${k}|${t.currency}`;
    groups.set(g, [...(groups.get(g) ?? []), t]);
  }
  const out: DetectedSubscription[] = [];
  for (const [g, list] of groups) {
    const items = [...list].sort((a, b) => a.date.localeCompare(b.date));
    // Two charges on the same day are one payment split, or a duplicate: keep one per day.
    const days = items.filter((t, i) => i === 0 || t.date !== items[i - 1].date);
    if (days.length < 2) continue;
    const gaps = days.slice(1).map((t, i) => diffDays(t.date, days[i].date));
    const gap = median(gaps);
    const rhythm = RHYTHMS.find(([, lo, hi]) => gap >= lo && gap <= hi);
    if (!rhythm) continue;
    const [frequency, lo, hi] = rhythm;
    if (days.length < (frequency === 'yearly' ? 2 : 3)) continue;
    if (gaps.some((d) => d < lo * 0.75 || d > hi * 1.25)) continue;
    const amounts = days.map((t) => t.amount);
    const typical = median(amounts);
    if (amounts.some((a) => Math.abs(a - typical) > typical * 0.15)) continue;
    const last = days[days.length - 1];
    if (diffDays(ref, last.date) > PERIOD[frequency] * 1.5) continue;
    out.push({
      key: g.split('|')[0], description: last.description, amount: last.amount, currency: last.currency, accountId: last.accountId, categoryId: last.categoryId,
      frequency, count: days.length, lastDate: last.date, nextDate: next(last.date, frequency), monthly: monthlyEquivalent(last.amount, frequency),
    });
  }
  return out.sort((a, b) => b.monthly - a.monthly);
}

/** Which monthly-plan bills deserve a reminder: due today or in the next `days` days and not yet paid. */
import type { PlanItem } from './plan';
import type { ISODate } from '../lib/dates';

export interface DueBill { name: string; amount: number; inDays: number }

export function billsDueSoon(items: PlanItem[], paid: Record<string, { paid: boolean }>, today: ISODate, days = 2): DueBill[] {
  const [y, m, d] = today.split('-').map(Number);
  const monthLen = new Date(y, m, 0).getDate();
  return items
    .filter((i) => i.dueDay && !paid[i.name]?.paid)
    .map((i) => {
      const due = Math.min(i.dueDay!, monthLen);
      // A bill whose day already passed this month is next due next month.
      const inDays = due >= d ? due - d : due + monthLen - d;
      return { name: i.name, amount: i.amount, inDays };
    })
    .filter((b) => b.inDays <= days)
    .sort((a, b) => a.inDays - b.inDays);
}

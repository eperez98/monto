/** Windows notifications for monthly-plan bills due soon, shown at most once a day when Monto opens. */
import type { Engine } from '../db/engine';
import { isTauri } from '../db/adapters';
import { getPrefs, getProfile, getSetting, setSetting } from '../db/repo/core';
import { getExpensePlan, getPlanPaid } from '../db/repo/planning';
import { billsDueSoon } from '../domain/billAlerts';
import { formatMoney } from '../lib/money';
import { today } from '../lib/dates';
import { tr } from '../lib/i18n';

export async function notifyBillsDue(e: Engine, memberId: string): Promise<void> {
  if (!isTauri() || getPrefs(e).billAlerts === false) return;
  const key = `billAlertDay:${memberId}`;
  const day = today();
  if (getSetting<{ day: string }>(e, key, { day: '' }).day === day) return;
  const due = billsDueSoon(getExpensePlan(e, memberId), getPlanPaid(e, memberId), day);
  if (!due.length) return;
  const n = await import('@tauri-apps/plugin-notification');
  let ok = await n.isPermissionGranted();
  if (!ok) ok = (await n.requestPermission()) === 'granted';
  if (!ok) return;
  const cur = getProfile(e).primaryCurrency;
  const when = (d: number) => (d === 0 ? tr('hoy') : d === 1 ? tr('mañana') : tr('en {n} días', { n: d }));
  n.sendNotification({
    title: due.length === 1 ? tr('{name} vence {when}', { name: due[0].name, when: when(due[0].inDays) }) : tr('{n} pagos vencen pronto', { n: due.length }),
    body: due.map((b) => `${b.name} · ${when(b.inDays)} · ${formatMoney(b.amount, cur)}`).join('\n'),
  });
  setSetting(e, key, { day });
}

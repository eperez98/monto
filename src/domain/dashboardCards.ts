/** Cards of the "Capas tranquilas" summary that the user can show, hide and reorder. */
export const DASH_CARDS = ['balances', 'recap', 'quick', 'chart', 'pending', 'goals'] as const;
export type DashCard = (typeof DASH_CARDS)[number];
export interface DashCardPref { key: DashCard; on: boolean }

const isCard = (k: string): k is DashCard => (DASH_CARDS as readonly string[]).includes(k);

/** The saved order, without unknown or repeated cards, plus any card added in a newer version (shown, at the end). */
export function resolveCards(saved?: Array<{ key: string; on: boolean }>): DashCardPref[] {
  const out: DashCardPref[] = [];
  for (const c of saved ?? []) if (isCard(c.key) && !out.some((o) => o.key === c.key)) out.push({ key: c.key, on: !!c.on });
  for (const key of DASH_CARDS) if (!out.some((o) => o.key === key)) out.push({ key, on: true });
  return out;
}

export function moveCard(list: DashCardPref[], i: number, dir: -1 | 1): DashCardPref[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

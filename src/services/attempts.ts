/**
 * Remembers failed unlock attempts outside the database (which is still locked at that point), so closing and
 * reopening Monto doesn't reset the wait.
 */
import { afterTry, type Attempts } from '../domain/auth';
import { tr } from '../lib/i18n';

const KEY = 'monto:auth-attempts';
const read = (): Record<string, Attempts> => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; } };
const write = (v: Record<string, Attempts>) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode: back-off lasts this session only */ } };
const memory: Record<string, Attempts> = {};

/** Throws a readable error while `key` is locked out; otherwise runs `check` and records the result. */
export async function guarded(key: string, check: () => Promise<boolean>): Promise<boolean> {
  const all = { ...memory, ...read() };
  const cur = all[key] ?? { failures: 0, until: 0 };
  const wait = cur.until - Date.now();
  if (wait > 0) throw new Error(tr('Demasiados intentos. Espera {s} s e inténtalo de nuevo.', { s: Math.ceil(wait / 1000) }));
  let ok = false;
  try { ok = await check(); } finally {
    all[key] = afterTry(cur, ok, Date.now());
    memory[key] = all[key];
    write(all);
  }
  return ok;
}

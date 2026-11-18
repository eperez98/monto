/** Password rules and the back-off after failed attempts (lock screen and member PINs). */
import { tr } from '../lib/i18n';

const COMMON = ['contraseña', 'contrasena', 'password', 'qwerty', 'abc123', '123456', 'monto', 'panama', 'colombia', 'admin', 'letmein', 'iloveyou'];

/** Why a new password isn't good enough, or null when it is. Existing passwords keep working. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return tr('Usa al menos 10 caracteres.');
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(pw) || !/\d/.test(pw)) return tr('Combina letras y números.');
  const low = pw.toLowerCase();
  if (COMMON.some((c) => low.includes(c)) || /^(.)\1+$/.test(pw)) return tr('Es demasiado fácil de adivinar.');
  return null;
}

/** Wait after `failures` wrong tries in a row: none for the first 4, then 30 s doubling up to 15 min. */
export function lockoutMs(failures: number): number {
  if (failures < 5) return 0;
  return Math.min(30_000 * 2 ** (failures - 5), 15 * 60_000);
}

export interface Attempts { failures: number; until: number }

/** Pure step: the state after one try. */
export function afterTry(prev: Attempts, ok: boolean, now: number): Attempts {
  if (ok) return { failures: 0, until: 0 };
  const failures = prev.failures + 1;
  return { failures, until: now + lockoutMs(failures) };
}

/** Backups, restore, JSON export and CSV import. */
import { Engine } from '../db/engine';
import { openFile, saveFile, stamp } from './files';
import { getPrefs, setPrefs } from '../db/repo/core';
import { createTransaction } from '../db/repo/finance';
import { parseAmount } from '../domain/bankMail';
import type { Actor } from '../db/types';
import { tr } from '../lib/i18n';

export async function createBackup(e: Engine, label = 'manual'): Promise<string> {
  await e.flush();
  const name = `monto-${stamp()}-${label}.monto`;
  const path = await e.adapter.backup(await e.serialize(), name);
  return path;
}

/** When a backup was made, read from its name (monto-YYYYMMDD-HHMMSS-label.monto); null if the name has no date. */
export function backupDate(name: string): Date | null {
  const m = /^monto-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/.exec(name);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
}

/** Backups older than `days`, oldest first. The newest backup is never included, so one copy always remains. */
export function oldBackups(list: Array<{ name: string; date?: string }>, days = 30, now = new Date()): string[] {
  const dated = list.map((b) => ({ name: b.name, at: backupDate(b.name) ?? (b.date ? new Date(b.date) : null) })).filter((b): b is { name: string; at: Date } => !!b.at);
  const newest = dated.reduce<{ name: string; at: Date } | null>((a, b) => (!a || b.at > a.at ? b : a), null);
  const cutoff = now.getTime() - days * 86_400_000;
  return dated.filter((b) => b.at.getTime() < cutoff && b.name !== newest?.name).sort((a, b) => a.at.getTime() - b.at.getTime()).map((b) => b.name);
}

export async function deleteOldBackups(e: Engine, days = 30): Promise<number> {
  const names = oldBackups(await e.adapter.listBackups(), days);
  for (const n of names) await e.adapter.deleteBackup(n);
  return names.length;
}

/** One automatic backup per day, keeping data safe before updates. */
export async function autoBackup(e: Engine): Promise<string | null> {
  const day = new Date().toISOString().slice(0, 10);
  if (getPrefs(e).recentAutoBackup === day) return null;
  const p = await createBackup(e, 'auto');
  setPrefs(e, { recentAutoBackup: day });
  return p;
}

export async function exportBackupFile(e: Engine) {
  await e.flush();
  return saveFile(`monto-respaldo-${stamp()}.monto`, await e.serialize(), [{ name: tr('Respaldo de Monto'), extensions: ['monto'] }]);
}

export async function pickBackupFile() { return openFile([{ name: tr('Respaldo de Monto'), extensions: ['monto', 'db', 'sqlite'] }]); }

/** Restore from bytes after validating integrity. A safety backup is created first. */
export async function restoreFromBytes(e: Engine, bytes: Uint8Array, password?: string) {
  const v = await Engine.validateBytes(bytes, password);
  if (!v.ok || !v.plain) throw new Error(v.error ?? tr('Copia no válida'));
  await createBackup(e, 'antes-de-restaurar');
  await e.replaceWith(v.plain);
}

export async function exportJSON(e: Engine) {
  const tables = ['members', 'accounts', 'categories', 'transactions', 'transaction_splits', 'income_sources', 'budgets', 'goals', 'goal_contributions', 'debts', 'recurring', 'reminders', 'settlements'];
  const out: Record<string, unknown> = { app: 'Monto', format: 1, exportedAt: new Date().toISOString() };
  for (const t of tables) out[t] = e.all(`SELECT * FROM ${t}`).map((r) => { const { pin_hash: _p, ...rest } = r as Record<string, unknown>; return rest; });
  return saveFile(`monto-datos-${stamp()}.json`, JSON.stringify(out, null, 2), [{ name: 'JSON', extensions: ['json'] }], 'application/json');
}

/** Parse a CSV line respecting quotes. */
export function parseCSVLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === sep) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export interface CsvImportResult { imported: number; skipped: number; errors: string[] }

/**
 * Import transactions from a CSV or a bank statement: fecha, descripcion and either importe or débito/crédito
 * columns (categoria and tipo optional). Negative amounts, débitos or tipo=gasto are expenses. Without a
 * category column the automatic rules choose one; rows already in the account are skipped.
 */
/** An amount as banks write it: "-45.80", "45.80-", "(45.80)" or "45.80 DB" are money out; both decimal styles. */
export function signedAmount(raw: string): number {
  const t = raw.trim();
  const negative = /^-|-$|^\(.*\)$|\b(DB|D)$/i.test(t);
  const v = parseAmount(t.replace(/[^\d.,]/g, ''));
  return negative ? -v : v;
}

export function importTransactionsCSV(e: Engine, actor: Actor, text: string, accountId: string): CsvImportResult {
  const acc = e.get<{ currency: 'PAB' | 'USD' }>('SELECT currency FROM accounts WHERE id = ?', [accountId]);
  if (!acc) throw new Error(tr('Selecciona una cuenta válida'));
  const all = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!all.length) return { imported: 0, skipped: 0, errors: [tr('El archivo está vacío')] };
  const norm = (h: string) => h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  // Statements from Panama banks start with a few rows about the account; the table begins at the first row that names a date column.
  const start = Math.max(0, all.slice(0, 15).findIndex((l) => /fecha|date/.test(norm(l)) && /desc|concepto|detalle|transac|monto|importe|debito|credito/.test(norm(l))));
  const lines = all.slice(start);
  const sep = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ';' : lines[0].includes('\t') ? '\t' : ',';
  const head = parseCSVLine(lines[0], sep).map(norm);
  // Names in priority order; a column already used for something else is not taken again.
  const used = new Set<number>();
  const idx = (names: string[]) => { for (const n of names) { const k = head.findIndex((h, j) => !used.has(j) && h.includes(n)); if (k >= 0) { used.add(k); return k; } } return -1; };
  const iDate = idx(['fecha', 'date']), iDesc = idx(['descripcion', 'desc', 'concepto', 'detalle', 'comercio', 'narrativa', 'movimiento', 'transaccion', 'beneficiario']);
  const iAmt = idx(['importe', 'monto', 'amount', 'valor']), iCat = idx(['categ']), iType = idx(['tipo', 'type']);
  // Bank statements often split the amount into "Débito" (money out) and "Crédito" (money in) columns.
  const iDeb = idx(['debito', 'cargo', 'retiro', 'salida', 'egreso']), iCred = idx(['credito', 'abono', 'deposito', 'entrada']);
  const split = iAmt < 0 && (iDeb >= 0 || iCred >= 0);
  if (iDate < 0 || iDesc < 0 || (iAmt < 0 && !split)) throw new Error(tr('El CSV debe tener columnas fecha, descripción e importe (o débito y crédito).'));
  const exists = (date: string, amount: number, description: string) => !!e.get('SELECT 1 FROM transactions WHERE account_id = ? AND date = ? AND amount = ? AND description = ?', [accountId, date, amount, description]);
  const cats = e.all<{ id: string; name: string; kind: string }>('SELECT id, name, kind FROM categories');
  const res: CsvImportResult = { imported: 0, skipped: 0, errors: [] };
  e.transaction(() => {
    lines.slice(1).forEach((line, n) => {
      const c = parseCSVLine(line, sep);
      try {
        let date = (c[iDate] ?? '').trim();
        const dm = date.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
        if (dm) date = `${dm[3].length === 2 ? `20${dm[3]}` : dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`;
        const num = (i: number) => (i >= 0 && c[i]?.trim() ? Math.abs(signedAmount(c[i])) : 0);
        let amount = split ? num(iCred) - num(iDeb) : signedAmount(c[iAmt] ?? '');
        if (Number.isNaN(amount) || amount === 0) throw new Error(tr('importe no válido'));
        const t = iType >= 0 ? norm(c[iType] ?? '') : '';
        const isExpense = /^(gas|exp|deb|db|cargo|retiro|compra|pago)/.test(t) || (!/^(ing|inc|cr|abono|deposito)/.test(t) && amount < 0);
        amount = Math.abs(amount);
        const kind = isExpense ? 'expense' : 'income';
        const cat = iCat >= 0 ? cats.find((x) => x.kind === kind && x.name.toLowerCase() === c[iCat]?.toLowerCase()) : undefined;
        const description = (c[iDesc] || tr('Importado')).trim().slice(0, 120);
        // Importing the same statement twice doesn't duplicate movements.
        if (exists(date, amount, description)) { res.skipped++; return; }
        createTransaction(e, actor, { type: kind, description, amount, currency: acc.currency, date, accountId, categoryId: cat?.id ?? null, notes: tr('Importado desde CSV') });
        res.imported++;
      } catch (err) {
        res.skipped++;
        if (res.errors.length < 5) res.errors.push(tr('Fila {v0}: {message}', { v0: n + 2, message: (err as Error).message }));
      }
    });
  });
  return res;
}

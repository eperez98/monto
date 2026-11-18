import { describe, expect, it } from 'vitest';
import { MemoryAdapter, safeBackupName } from '../db/adapters';
import { backupDate, oldBackups } from './backup';

describe('old backups cleanup', () => {
  const now = new Date(2026, 10, 14, 12, 0, 0);
  it('reads the date from the backup name', () => {
    expect(backupDate('monto-20261014-093000-auto.monto')).toEqual(new Date(2026, 9, 14, 9, 30, 0));
    expect(backupDate('otra.monto')).toBeNull();
  });

  it('lists only backups older than 30 days, oldest first', () => {
    const list = ['monto-20261110-080000-auto.monto', 'monto-20260901-080000-auto.monto', 'monto-20261001-080000-manual.monto', 'monto-20261020-080000-auto.monto'].map((name) => ({ name }));
    expect(oldBackups(list, 30, now)).toEqual(['monto-20260901-080000-auto.monto', 'monto-20261001-080000-manual.monto']);
  });

  it('always keeps the newest backup, even if it is old', () => {
    expect(oldBackups([{ name: 'monto-20250101-080000-auto.monto' }, { name: 'monto-20250201-080000-auto.monto' }], 30, now)).toEqual(['monto-20250101-080000-auto.monto']);
  });

  it('rejects names that could escape the backups folder', async () => {
    expect(() => safeBackupName(String.raw`..\monto.db.monto`)).toThrow();
    expect(() => safeBackupName('a/b.monto')).toThrow();
    expect(() => safeBackupName('monto.db')).toThrow();
    const m = new MemoryAdapter();
    await m.backup(new Uint8Array([1]), 'monto-20250101-080000-auto.monto');
    await m.deleteBackup('monto-20250101-080000-auto.monto');
    expect(await m.listBackups()).toEqual([]);
  });
});

describe('bank statement CSV import', () => {
  it('reads Débito/Crédito columns, two-digit years, automatic categories and skips repeats', async () => {
    const { freshEngine } = await import('../test/helpers');
    const { createAccount, getAccount, listTransactions } = await import('../db/repo/finance');
    const { categoryIdByName } = await import('../db/repo/core');
    const { importTransactionsCSV } = await import('./backup');
    const { e, actor } = await freshEngine();
    const acc = createAccount(e, actor, { name: 'Banco', type: 'checking', currency: 'PAB', initialBalance: 100000 });
    const csv = 'Fecha;Descripción;Débito;Crédito;Saldo\n14/11/26;COMPRA SUPER 99 ALBROOK;45,80;;954,20\n15/11/2026;DEPOSITO PLANILLA;;1.500,00;2.454,20\n';
    const r = importTransactionsCSV(e, actor, csv, acc.id);
    expect(r).toMatchObject({ imported: 2, skipped: 0 });
    expect(getAccount(e, acc.id)!.balance).toBe(100000 - 4580 + 150000);
    const txs = listTransactions(e, {});
    expect(txs.find((t) => t.description.includes('SUPER 99'))).toMatchObject({ type: 'expense', date: '2026-11-14', categoryId: categoryIdByName(e, 'Alimentación', 'expense') });
    expect(txs.find((t) => t.description.includes('PLANILLA'))?.type).toBe('income');
    expect(importTransactionsCSV(e, actor, csv, acc.id)).toMatchObject({ imported: 0, skipped: 2 });
  });
  it('finds the table after the account rows and reads signed amounts and DB/CR types', async () => {
    const { freshEngine } = await import('../test/helpers');
    const { createAccount, listTransactions } = await import('../db/repo/finance');
    const { importTransactionsCSV, signedAmount } = await import('./backup');
    expect([signedAmount('-45.80'), signedAmount('45.80-'), signedAmount('(45.80)'), signedAmount('45.80 DB'), signedAmount('1.250,00')]).toEqual([-4580, -4580, -4580, -4580, 125000]);
    const { e, actor } = await freshEngine();
    const acc = createAccount(e, actor, { name: 'Banco', type: 'checking', currency: 'PAB', initialBalance: 0 });
    const csv = 'Cuenta,0400000000\nPeríodo,Noviembre 2026\nFecha de transacción,Referencia,Descripción,Tipo,Monto\n14/11/2026,991,CAFE EJEMPLO,DB,4.50\n15/11/2026,992,PLANILLA,CR,1500.00\n16/11/2026,993,FARMACIA EJEMPLO,,(8.25)\n';
    expect(importTransactionsCSV(e, actor, csv, acc.id)).toMatchObject({ imported: 3, skipped: 0 });
    const t = listTransactions(e, {});
    expect(t.map((x) => [x.description, x.type, x.amount]).sort()).toEqual([['CAFE EJEMPLO', 'expense', 450], ['FARMACIA EJEMPLO', 'expense', 825], ['PLANILLA', 'income', 150000]]);
  });
});

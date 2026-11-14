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

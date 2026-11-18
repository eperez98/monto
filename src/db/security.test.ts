import { afterEach, describe, expect, it } from 'vitest';
import { Engine } from './engine';
import { MemoryAdapter } from './adapters';
import { ForeignDeviceError, decrypt, deriveKey, hashSecret, importDeviceKey, isDeviceEncrypted, isEncrypted, newDeviceKeyBase64, setDeviceKeyProvider, sha256Hex, verifySecret } from './crypto';
import { afterTry, lockoutMs, passwordProblem } from '../domain/auth';
import { createBackup, protectOldBackups } from '../services/backup';
import { freshEngine } from '../test/helpers';
import { createMember, verifyMemberPin, setMemberPin } from './repo/core';

const SQLITE = new TextEncoder().encode('SQLite format 3');
const startsSqlite = (b: Uint8Array) => SQLITE.every((x, i) => b[i] === x);

afterEach(() => setDeviceKeyProvider(null));

describe('database protected with this computer key', () => {
  it('encrypts a file saved in the clear on open, reopens it, and refuses another computer key', async () => {
    const adapter = new MemoryAdapter();
    const plain = await Engine.open(adapter);
    plain.run("INSERT INTO settings (key, value) VALUES ('probe', '\"hola\"')");
    await plain.flush();
    expect(startsSqlite((await adapter.load())!)).toBe(true);

    const key = await importDeviceKey(newDeviceKeyBase64());
    setDeviceKeyProvider(async () => key);
    const e = await Engine.open(adapter);
    const onDisk = (await adapter.load())!;
    expect(isDeviceEncrypted(onDisk)).toBe(true);
    expect(new TextDecoder().decode(onDisk).includes('hola')).toBe(false);
    expect(e.protectedAtRest && !e.encrypted).toBe(true);

    expect((await Engine.open(adapter)).get<{ value: string }>("SELECT value FROM settings WHERE key = 'probe'")?.value).toBe('"hola"');

    const other = await importDeviceKey(newDeviceKeyBase64());
    setDeviceKeyProvider(async () => other);
    await expect(Engine.open(adapter)).rejects.toBeInstanceOf(ForeignDeviceError);
  });

  it('encrypts old backups saved in the clear, and new ones too', async () => {
    const adapter = new MemoryAdapter();
    const e0 = await Engine.open(adapter);
    await adapter.backup(e0.plainBytes(), 'monto-20260101-000000-auto.monto');
    setDeviceKeyProvider(async () => importDeviceKey(newDeviceKeyBase64()));
    const e = await Engine.open(adapter);
    expect(await protectOldBackups(e)).toBe(1);
    await createBackup(e, 'manual');
    for (const b of await adapter.listBackups()) expect(isDeviceEncrypted(await adapter.readBackup(b.name))).toBe(true);
    expect(await protectOldBackups(e)).toBe(0);
  });
});

describe('password files', () => {
  it('upgrades a 310k-iteration file to the 600k format after unlocking', async () => {
    const adapter = new MemoryAdapter();
    const e = await Engine.open(adapter);
    // Build an old-format (MONTOENC1, 310k) file by hand.
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey('clave-segura-123', salt, 310_000);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, e.plainBytes() as BufferSource));
    const old = new Uint8Array([...new TextEncoder().encode('MONTOENC1'), ...salt, ...iv, ...ct]);
    await adapter.save(old);
    const opened = await Engine.open(adapter, { password: 'clave-segura-123' });
    expect(opened.encrypted).toBe(true);
    const now = (await adapter.load())!;
    expect(isEncrypted(now) && new TextDecoder().decode(now.slice(0, 9))).toBe('MONTOENC2');
    await expect(decrypt(now, 'clave-segura-123')).resolves.toBeTruthy();
  }, 20_000);
});

describe('PINs and passwords', () => {
  it('hashes PINs slowly with a salt and upgrades old SHA-256 PINs on the next correct entry', async () => {
    const h1 = await hashSecret('1234', 1000), h2 = await hashSecret('1234', 1000);
    expect(h1).not.toBe(h2);
    expect(await verifySecret('1234', h1)).toBe(true);
    expect(await verifySecret('1235', h1)).toBe(false);

    const { e, actor } = await freshEngine();
    const m = createMember(e, actor, { name: 'Ana', role: 'adult' });
    e.run('UPDATE members SET pin_hash = ? WHERE id = ?', [await sha256Hex(`monto:${m.id}:4321`), m.id]);
    expect(await verifyMemberPin(e, m.id, '1111')).toBe(false);
    expect(await verifyMemberPin(e, m.id, '4321')).toBe(true);
    expect(e.get<{ pin_hash: string }>('SELECT pin_hash FROM members WHERE id = ?', [m.id])?.pin_hash.startsWith('pbkdf2$')).toBe(true);
    expect(await verifyMemberPin(e, m.id, '4321')).toBe(true);
    await setMemberPin(e, actor, m.id, '9876');
    expect(await verifyMemberPin(e, m.id, '9876')).toBe(true);
  }, 20_000);

  it('asks for stronger new passwords', () => {
    expect(passwordProblem('corta1')).toBeTruthy();
    expect(passwordProblem('soloLetrasLargas')).toBeTruthy();
    expect(passwordProblem('password12345')).toBeTruthy();
    expect(passwordProblem('clave-segura-123')).toBeNull();
  });

  it('waits longer after each wrong attempt past the fourth, up to 15 minutes', () => {
    expect([1, 4, 5, 6, 7, 20].map(lockoutMs)).toEqual([0, 0, 30_000, 60_000, 120_000, 900_000]);
    let s = { failures: 0, until: 0 };
    for (let i = 0; i < 5; i++) s = afterTry(s, false, 1000);
    expect(s).toEqual({ failures: 5, until: 31_000 });
    expect(afterTry(s, true, 2000)).toEqual({ failures: 0, until: 0 });
  });
});

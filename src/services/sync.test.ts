import { describe, expect, it } from 'vitest';
import { freshEngine } from '../test/helpers';
import { isEncrypted } from '../db/crypto';
import { syncOnce, type SyncMeta, type SyncState, type SyncTransport } from './sync';

/** A shared folder in memory, standing in for OneDrive. */
function memoryFolder() {
  const f: { data: Uint8Array | null; meta: SyncMeta | null } = { data: null, meta: null };
  const t: SyncTransport = { meta: async () => f.meta, read: async () => f.data, write: async (d, m) => { f.data = d; f.meta = m; } };
  return { f, t };
}
const fresh = (): SyncState => ({ folder: 'X', lastRev: null, lastHash: null, lastAt: null });
const PW = 'sincroniza-2026';
const probe = (e: Awaited<ReturnType<typeof freshEngine>>['e']) => e.get<{ value: string }>("SELECT value FROM settings WHERE key = 'probe'")?.value ?? null;

describe('sync through a shared folder', () => {
  it('uploads encrypted, downloads on the other computer, then only uploads real changes', async () => {
    const { f, t } = memoryFolder();
    const home = await freshEngine(), work = await freshEngine();
    home.e.run("INSERT INTO settings (key, value) VALUES ('probe', '\"casa\"')");
    let a = await syncOnce(home.e, t, PW, fresh());
    expect(a.outcome).toBe('pushed');
    expect(isEncrypted(f.data!)).toBe(true);
    expect(new TextDecoder().decode(f.data!).includes('casa')).toBe(false);

    // The second computer starts with its own empty data: both "changed", so the user chooses.
    let b = await syncOnce(work.e, t, PW, fresh());
    expect(b.outcome).toBe('conflict');
    b = await syncOnce(work.e, t, PW, b.state, 'keep-remote');
    expect(b.outcome).toBe('pulled');
    expect(probe(work.e)).toBe('"casa"');
    expect((await syncOnce(work.e, t, PW, b.state)).outcome).toBe('unchanged');

    // A change at work reaches home; home had nothing new, so it downloads on its own at start-up.
    work.e.run("UPDATE settings SET value = '\"oficina\"' WHERE key = 'probe'");
    b = await syncOnce(work.e, t, PW, b.state);
    expect(b.outcome).toBe('pushed');
    expect((await syncOnce(home.e, t, PW, a.state, 'background')).outcome).toBe('remote-newer');
    a = await syncOnce(home.e, t, PW, a.state);
    expect(a.outcome).toBe('pulled');
    expect(probe(home.e)).toBe('"oficina"');
  });

  it('asks when both computers changed, and refuses a wrong password', async () => {
    const { t } = memoryFolder();
    const home = await freshEngine(), work = await freshEngine();
    let a = await syncOnce(home.e, t, PW, fresh());
    let b = await syncOnce(work.e, t, PW, fresh(), 'keep-remote');
    home.e.run("INSERT INTO settings (key, value) VALUES ('probe', '\"casa\"')");
    work.e.run("INSERT INTO settings (key, value) VALUES ('probe', '\"oficina\"')");
    a = await syncOnce(home.e, t, PW, a.state);
    expect(a.outcome).toBe('pushed');
    expect((await syncOnce(work.e, t, PW, b.state)).outcome).toBe('conflict');
    b = await syncOnce(work.e, t, PW, b.state, 'keep-local');
    expect(b.outcome).toBe('pushed');
    await expect(syncOnce(home.e, t, 'otra-clave-123', a.state)).rejects.toThrow(/no coincide/);
  });
});

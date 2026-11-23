/**
 * Encrypted sync between the user's computers through a folder they already sync (OneDrive, Google Drive…).
 * The folder holds the profile encrypted with a sync password (AES-256-GCM, PBKDF2 600 000) plus a revision id;
 * the sync client of the user's choice moves the file. Monto never talks to a server.
 *
 * One rule decides each sync, comparing with the state of the last sync on this computer:
 * - only this computer changed → upload; only the folder changed → download (after a local backup);
 * - both changed → the user chooses which copy to keep. Nothing is merged, so nothing is half-applied.
 */
import { Engine, uid } from '../db/engine';
import { activeProfileId, isTauri } from '../db/adapters';
import { encrypt, newKey, type KeyMaterial } from '../db/crypto';
import { passwordProblem } from '../domain/auth';
import { createBackup } from './backup';
import { APP_VERSION } from '../lib/version';
import { IS_PREVIEW } from '../lib/preview';
import { tr } from '../lib/i18n';

export interface SyncMeta { rev: string; at: string; app: string }
export interface SyncTransport { meta(): Promise<SyncMeta | null>; read(): Promise<Uint8Array | null>; write(data: Uint8Array, meta: SyncMeta): Promise<void> }
/** What this computer remembers about the last sync (kept outside the database, which a download replaces). */
export interface SyncState { folder: string; lastRev: string | null; lastHash: string | null; lastAt: string | null }
export type SyncOutcome = 'pushed' | 'pulled' | 'unchanged' | 'conflict' | 'remote-newer';

const sha256 = async (b: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', b as BufferSource))].map((x) => x.toString(16).padStart(2, '0')).join('');

// The sync key is derived once per session (600 000 iterations take a moment) and reused for every upload.
let cachedKey: { password: string; km: KeyMaterial } | null = null;
async function keyFor(password: string) {
  if (cachedKey?.password !== password) cachedKey = { password, km: await newKey(password) };
  return cachedKey.km;
}

/**
 * One sync step. `mode`: 'auto' downloads when only the folder changed (at start-up); 'background' never replaces the
 * open data on its own and reports 'remote-newer' instead; 'keep-remote' / 'keep-local' settle a conflict.
 */
export async function syncOnce(e: Engine, t: SyncTransport, password: string, state: SyncState, mode: 'auto' | 'background' | 'keep-remote' | 'keep-local' = 'auto'): Promise<{ outcome: SyncOutcome; state: SyncState }> {
  await e.flush();
  const meta = await t.meta();
  const hash = await sha256(e.plainBytes());
  const localChanged = hash !== state.lastHash;
  const remoteChanged = !!meta && meta.rev !== state.lastRev;
  const now = new Date().toISOString();

  const push = async () => {
    const m: SyncMeta = { rev: uid(), at: now, app: APP_VERSION };
    await t.write(await encrypt(e.plainBytes(), await keyFor(password)), m);
    return { outcome: 'pushed' as const, state: { ...state, lastRev: m.rev, lastHash: hash, lastAt: now } };
  };
  const pull = async () => {
    const bytes = await t.read();
    if (!bytes || !meta) throw new Error(tr('No se encontraron los datos en la carpeta de sincronización.'));
    const v = await Engine.validateBytes(bytes, password);
    if (!v.ok || !v.plain) throw new Error(/contraseña|password/i.test(v.error ?? '') || /incorrect/i.test(v.error ?? '') ? tr('La contraseña de sincronización no coincide con la de la carpeta.') : v.error ?? tr('Copia no válida'));
    await createBackup(e, 'antes-de-sincronizar');
    await e.replaceWith(v.plain);
    return { outcome: 'pulled' as const, state: { ...state, lastRev: meta.rev, lastHash: await sha256(e.plainBytes()), lastAt: now } };
  };

  if (mode === 'keep-local') return push();
  if (mode === 'keep-remote') return pull();
  if (!meta) return push();
  if (remoteChanged && localChanged) return { outcome: 'conflict', state };
  if (remoteChanged) return mode === 'background' ? { outcome: 'remote-newer', state } : pull();
  if (localChanged) return push();
  return { outcome: 'unchanged', state };
}

// ------------------------------------------------------------------ desktop wiring
const STATE_KEY = (profile: string) => `monto:sync:${profile}`;
export function getSyncState(profile = activeProfileId()): SyncState | null {
  try { const s = JSON.parse(localStorage.getItem(STATE_KEY(profile)) ?? 'null') as SyncState | null; return s?.folder ? s : null; } catch { return null; }
}
export function saveSyncState(s: SyncState | null, profile = activeProfileId()) {
  try { if (s) localStorage.setItem(STATE_KEY(profile), JSON.stringify(s)); else localStorage.removeItem(STATE_KEY(profile)); } catch { /* sync stays off on this computer */ }
}
export const syncSupported = () => isTauri() && !IS_PREVIEW;

async function invoke<T>(cmd: string, args: Record<string, unknown>) {
  const { invoke: call } = await import('@tauri-apps/api/core');
  return call<T>(cmd, args);
}
export function folderTransport(folder: string, profile = activeProfileId()): SyncTransport {
  return {
    meta: async () => { const s = await invoke<string | null>('sync_meta', { folder, profile }); try { return s ? (JSON.parse(s) as SyncMeta) : null; } catch { return null; } },
    read: async () => { const b = await invoke<number[] | null>('sync_read', { folder, profile }); return b ? new Uint8Array(b) : null; },
    write: (data, meta) => invoke('sync_write', { folder, profile, data: Array.from(data), meta: JSON.stringify(meta) }),
  };
}
export const syncPassword = (profile = activeProfileId()) => invoke<string | null>('sync_secret_get', { profile });

/** Choose a folder with the system dialog. */
export async function pickSyncFolder(): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const r = await open({ directory: true, multiple: false, title: tr('Elige la carpeta que sincronizas (OneDrive, Google Drive…)') });
  return typeof r === 'string' ? r : null;
}

/**
 * Turn sync on for this profile. `first`: this is the first computer (the password is new, so it must be strong).
 * Returns the first sync's outcome; 'conflict' means the folder already has other data and the user must choose.
 */
export async function enableSync(e: Engine, folder: string, password: string, first: boolean): Promise<SyncOutcome> {
  if (first) { const weak = passwordProblem(password); if (weak) throw new Error(weak); }
  const t = folderTransport(folder);
  const state: SyncState = { folder, lastRev: null, lastHash: null, lastAt: null };
  // On another computer the password has to open what's already in the folder.
  const existing = await t.read();
  if (existing) {
    const v = await Engine.validateBytes(existing, password);
    if (!v.ok) throw new Error(tr('La contraseña de sincronización no coincide con la de la carpeta.'));
  }
  await invoke('sync_secret_set', { profile: activeProfileId(), secret: password });
  const r = await syncOnce(e, t, password, state, existing ? 'background' : 'auto');
  // The folder has data and this computer too: the user decides (see SyncChoice). Remember the folder meanwhile.
  saveSyncState(r.state);
  return r.outcome === 'remote-newer' ? 'conflict' : r.outcome;
}

export async function disableSync(profile = activeProfileId()) {
  saveSyncState(null, profile);
  cachedKey = null;
  await invoke('sync_secret_clear', { profile }).catch(() => undefined);
}

/** Run a sync with the saved folder and password; null when sync is off on this computer. */
export async function runSync(e: Engine, mode: Parameters<typeof syncOnce>[4] = 'auto'): Promise<SyncOutcome | null> {
  const state = getSyncState();
  if (!state || !syncSupported()) return null;
  const password = await syncPassword();
  if (!password) return null;
  const r = await syncOnce(e, folderTransport(state.folder), password, state, mode);
  saveSyncState(r.state);
  return r.outcome;
}

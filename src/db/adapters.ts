
import { tr } from '../lib/i18n';/**
 * Storage adapters. The SQLite database lives in memory (sql.js / WASM) and
 * is persisted as a single file:
 *  - Desktop (Tauri): %APPDATA%\com.monto.finanzas\monto.db  (atomic write)
 *  - Browser dev mode: IndexedDB
 *  - Tests: memory
 */
export interface StorageAdapter {
  readonly kind: 'tauri' | 'browser' | 'memory';
  load(): Promise<Uint8Array | null>;
  save(bytes: Uint8Array): Promise<void>;
  /** Write a timestamped backup copy and return its name/path. */
  backup(bytes: Uint8Array, name: string): Promise<string>;
  listBackups(): Promise<Array<{ name: string; size?: number; date?: string }>>;
  readBackup(name: string): Promise<Uint8Array>;
  location(): Promise<string>;
  /** Delete one backup by the name listBackups returned. */
  deleteBackup(name: string): Promise<void>;
  /** Delete this profile's database file (its backups are kept). */
  remove(): Promise<void>;
}

/** A backup file name, never a path: blocks `..\` or `/` from reaching the file system. */
export function safeBackupName(name: string): string {
  if (!/^[\w.-]+\.monto$/.test(name) || name.includes('..')) throw new Error(tr('Nombre de copia no válido.'));
  return name;
}

export const isTauri = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export class MemoryAdapter implements StorageAdapter {
  readonly kind = 'memory' as const;
  data: Uint8Array | null = null;
  backups = new Map<string, Uint8Array>();
  async load() { return this.data; }
  async save(b: Uint8Array) { this.data = b.slice(); }
  async backup(b: Uint8Array, name: string) { this.backups.set(name, b.slice()); return name; }
  async listBackups() { return [...this.backups.keys()].map((name) => ({ name, size: this.backups.get(name)!.length })); }
  async readBackup(name: string) { const b = this.backups.get(name); if (!b) throw new Error(tr('Copia no encontrada')); return b; }
  async location() { return 'memoria'; }
  async remove() { this.data = null; }
  async deleteBackup(name: string) { this.backups.delete(safeBackupName(name)); }
}

const IDB_NAME = 'monto';
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('files'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbOp<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction('files', mode);
    const req = fn(tx.objectStore('files'));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export class BrowserAdapter implements StorageAdapter {
  readonly kind = 'browser' as const;
  private file: string;
  private bk: string;
  constructor(profileId = DEFAULT_PROFILE_ID) { this.file = `${stemOf(profileId)}.db`; this.bk = profileId === DEFAULT_PROFILE_ID ? 'backup/' : `backup-${profileId}/`; }
  async load() { return ((await idbOp('readonly', (s) => s.get(this.file))) as Uint8Array | undefined) ?? null; }
  async save(b: Uint8Array) { await idbOp('readwrite', (s) => s.put(b, this.file)); }
  async remove() { await idbOp('readwrite', (s) => s.delete(this.file)); }
  async deleteBackup(name: string) { await idbOp('readwrite', (s) => s.delete(`${this.bk}${safeBackupName(name)}`)); }
  async backup(b: Uint8Array, name: string) { await idbOp('readwrite', (s) => s.put(b, `${this.bk}${name}`)); return name; }
  async listBackups() {
    const keys = (await idbOp('readonly', (s) => s.getAllKeys())) as string[];
    return keys.filter((k) => String(k).startsWith(this.bk)).map((k) => ({ name: String(k).slice(this.bk.length) })).sort((a, b) => b.name.localeCompare(a.name));
  }
  async readBackup(name: string) { const b = await idbOp('readonly', (s) => s.get(`${this.bk}${name}`)); if (!b) throw new Error(tr('Copia no encontrada')); return b as Uint8Array; }
  async location() { return tr('IndexedDB del navegador (modo desarrollo)'); }
}

export class TauriAdapter implements StorageAdapter {
  readonly kind = 'tauri' as const;
  private stem: string;
  constructor(private profileId = DEFAULT_PROFILE_ID) { this.stem = stemOf(profileId); }
  private async fs() { return import('@tauri-apps/plugin-fs'); }
  private async dir() {
    const { appDataDir, join } = await import('@tauri-apps/api/path');
    const base = await appDataDir();
    const { mkdir, exists } = await this.fs();
    // Extra profiles keep their backups in their own sub-folder so restores never mix profiles.
    const backups = this.profileId === DEFAULT_PROFILE_ID ? await join(base, 'backups') : await join(base, 'backups', this.profileId);
    if (!(await exists(backups))) await mkdir(backups, { recursive: true });
    return { base, backups, join };
  }
  async load() {
    const { exists, readFile } = await this.fs();
    const { base, join } = await this.dir();
    const p = await join(base, `${this.stem}.db`);
    if (!(await exists(p))) {
      // Recover from an interrupted atomic write.
      const tmp = await join(base, `${this.stem}.db.tmp`);
      if (await exists(tmp)) return readFile(tmp);
      return null;
    }
    return readFile(p);
  }
  async save(b: Uint8Array) {
    const { writeFile, rename, exists, remove } = await this.fs();
    const { base, join } = await this.dir();
    const p = await join(base, `${this.stem}.db`);
    const tmp = await join(base, `${this.stem}.db.tmp`);
    await writeFile(tmp, b);
    if (await exists(p)) await remove(p);
    await rename(tmp, p);
  }
  async backup(b: Uint8Array, name: string) {
    const { writeFile } = await this.fs();
    const { backups, join } = await this.dir();
    const p = await join(backups, name);
    await writeFile(p, b);
    return p;
  }
  async listBackups() {
    const { readDir, stat } = await this.fs();
    const { backups, join } = await this.dir();
    const entries = await readDir(backups);
    const out = [];
    for (const e of entries) {
      if (!e.isFile || !e.name.endsWith('.monto')) continue;
      const st = await stat(await join(backups, e.name)).catch(() => null);
      out.push({ name: e.name, size: st?.size, date: st?.mtime ? new Date(st.mtime).toISOString() : undefined });
    }
    return out.sort((a, b) => b.name.localeCompare(a.name));
  }
  async readBackup(name: string) {
    const { readFile } = await this.fs();
    const { backups, join } = await this.dir();
    return readFile(await join(backups, safeBackupName(name)));
  }
  async location() { return (await this.dir()).base; }
  async deleteBackup(name: string) {
    const { remove } = await this.fs();
    const { backups, join } = await this.dir();
    await remove(await join(backups, safeBackupName(name)));
  }
  async remove() {
    const { exists, remove } = await this.fs();
    const { base, join } = await this.dir();
    for (const f of [`${this.stem}.db`, `${this.stem}.db.tmp`]) { const p = await join(base, f); if (await exists(p)) await remove(p); }
  }
}

export function defaultAdapter(profileId = activeProfileId()): StorageAdapter {
  if (isTauri()) return new TauriAdapter(profileId);
  if (typeof indexedDB !== 'undefined') return new BrowserAdapter(profileId);
  return new MemoryAdapter();
}

// ------------------------------------------------------------------ profiles
/** Each profile is its own database file; the first one keeps the original monto.db name. */
export const DEFAULT_PROFILE_ID = 'default';
export interface ProfileEntry { id: string; name: string }
const ACTIVE_KEY = 'monto:profile';
const stemOf = (id: string) => (id === DEFAULT_PROFILE_ID ? 'monto' : `monto-${id}`);

export function activeProfileId(): string {
  // The id becomes part of a file name, so anything unexpected falls back to the original profile.
  try { const id = localStorage.getItem(ACTIVE_KEY) ?? ''; return /^[\w-]{1,64}$/.test(id) ? id : DEFAULT_PROFILE_ID; } catch { return DEFAULT_PROFILE_ID; }
}
export function setActiveProfileId(id: string) { try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* falls back to the first profile */ } }

let memoryProfiles: ProfileEntry[] | null = null;
async function tauriProfilesPath() {
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  return join(await appDataDir(), 'profiles.json');
}
/** The profile list. Without a saved list there is just the original profile. */
export async function listProfiles(): Promise<ProfileEntry[]> {
  let raw: string | null = null;
  if (isTauri()) {
    const { exists, readTextFile } = await import('@tauri-apps/plugin-fs');
    const p = await tauriProfilesPath();
    if (await exists(p)) raw = await readTextFile(p);
  } else if (typeof indexedDB !== 'undefined') {
    raw = ((await idbOp('readonly', (s) => s.get('profiles.json'))) as string | undefined) ?? null;
  } else if (memoryProfiles) return memoryProfiles;
  try {
    const list = raw ? (JSON.parse(raw) as ProfileEntry[]).filter((p) => typeof p?.id === 'string' && /^[\w-]{1,64}$/.test(p.id)) : [];
    return list.length ? list : [{ id: DEFAULT_PROFILE_ID, name: '' }];
  } catch { return [{ id: DEFAULT_PROFILE_ID, name: '' }]; }
}
export async function saveProfiles(list: ProfileEntry[]): Promise<void> {
  const raw = JSON.stringify(list);
  if (isTauri()) {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    await writeTextFile(await tauriProfilesPath(), raw);
  } else if (typeof indexedDB !== 'undefined') await idbOp('readwrite', (s) => s.put(raw, 'profiles.json'));
  else memoryProfiles = list;
}

/** Several independent profiles (each its own database file): create, switch and delete. */
import { Engine, uid } from '../db/engine';
import { activeProfileId, defaultAdapter, DEFAULT_PROFILE_ID, MemoryAdapter, listProfiles, saveProfiles, setActiveProfileId } from '../db/adapters';
import { assertCan } from '../domain/permissions';
import { useApp } from '../store/app';
import { createBackup } from './backup';
import type { Actor } from '../db/types';

/** Save pending changes and reopen Monto on another profile. */
export async function switchProfile(id: string): Promise<void> {
  const e = useApp.getState().engine;
  if (e) await e.flush();
  setActiveProfileId(id);
  location.reload();
}

/** Register a new empty profile and open it; Monto starts the setup for it. */
export async function createProfile(name: string): Promise<void> {
  const id = uid();
  await saveProfiles([...(await listProfiles()), { id, name: name.trim().slice(0, 60) }]);
  await switchProfile(id);
}

/**
 * Delete the open profile's data and move to another profile (or a fresh setup if it was the last).
 * A final backup is written first, so a mistaken delete can still be restored from the backups folder.
 */
export async function deleteCurrentProfile(e: Engine, actor: Actor): Promise<void> {
  assertCan(actor.role, 'security.manage');
  const id = activeProfileId();
  await createBackup(e, 'antes-de-borrar');
  // Point any later autosave (timers, the close handler) at memory so nothing writes the file back.
  const file = e.adapter;
  e.adapter = new MemoryAdapter();
  await file.remove();
  const rest = (await listProfiles()).filter((p) => p.id !== id);
  await saveProfiles(rest);
  setActiveProfileId(rest[0]?.id ?? DEFAULT_PROFILE_ID);
  location.reload();
}

/**
 * Copy the open profile into a new one for a couple, so the original stays as it is.
 * Monto reopens on the copy and asks for the partner's data there (see PartnerSetupHost).
 */
export async function copyProfileForCouple(e: Engine, name: string, setupKey: string): Promise<void> {
  const id = uid();
  await e.flush();
  await defaultAdapter(id).save(await e.serialize());
  await saveProfiles([...(await listProfiles()), { id, name: name.trim().slice(0, 60) }]);
  try { localStorage.setItem(setupKey, id); } catch { /* the wizard can still be opened from Settings */ }
  await switchProfile(id);
}

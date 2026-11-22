/**
 * Unlock with Windows Hello. The desktop side keeps the profile's password in the Windows Credential Manager and only
 * returns it after Windows Hello (fingerprint, face or Windows PIN) confirms the user. Nothing of this exists in the
 * browser build.
 */
import { activeProfileId, isTauri } from '../db/adapters';
import { IS_PREVIEW } from '../lib/preview';

const call = async <T>(cmd: string, args?: Record<string, unknown>) => {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
};
const desktop = () => isTauri() && !IS_PREVIEW;

/** The computer has Windows Hello set up (a fingerprint reader, a camera or at least a Windows PIN). */
export const helloAvailable = async () => (desktop() ? call<boolean>('hello_available').catch(() => false) : false);
export const helloEnabled = async (profile = activeProfileId()) => (desktop() ? call<boolean>('hello_enabled', { profile }).catch(() => false) : false);
/** True if the user passed Windows Hello and the password is now kept; false if they cancelled. */
export const enableHello = (password: string, profile = activeProfileId()) => call<boolean>('hello_enable', { profile, secret: password });
export const disableHello = (profile = activeProfileId()) => (desktop() ? call<void>('hello_disable', { profile }) : Promise.resolve());
/** The password after a successful Windows Hello check, or null if cancelled. */
export const helloUnlock = (profile = activeProfileId()) => call<string | null>('hello_unlock', { profile });

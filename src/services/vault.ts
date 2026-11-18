/**
 * This computer's database key, kept by the desktop side in the Windows Credential Manager. Created once, never
 * replaced; the browser build and the phone preview have none and keep working unencrypted in memory.
 */
import { isTauri } from '../db/adapters';
import { importDeviceKey, newDeviceKeyBase64, setDeviceKeyProvider } from '../db/crypto';
import { IS_PREVIEW } from '../lib/preview';

let cached: Promise<CryptoKey | null> | null = null;

async function load(): Promise<CryptoKey | null> {
  const { invoke } = await import('@tauri-apps/api/core');
  let k = await invoke<string | null>('vault_device_key');
  if (!k) {
    await invoke('vault_create_device_key', { key: newDeviceKeyBase64() });
    k = await invoke<string | null>('vault_device_key');
  }
  return k ? importDeviceKey(k) : null;
}

export function installDeviceKey() {
  if (!isTauri() || IS_PREVIEW) return;
  setDeviceKeyProvider(() => {
    cached ??= load().catch((err) => {
      // Without the vault Monto still opens files saved in the clear; a protected file then says it can't be read.
      console.warn('Llave del equipo no disponible', err);
      cached = null;
      return null;
    });
    return cached;
  });
}

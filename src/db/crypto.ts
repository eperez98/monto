import { tr } from '../lib/i18n';
/**
 * At-rest encryption of the database file, always AES-256-GCM (GCM authenticates, so a wrong key simply fails).
 *
 * Two kinds of file:
 *  - With the user's password: PBKDF2-SHA256 → AES-GCM. No password hash is stored.
 *      "MONTOENC2" | salt (16) | iv (12) | ciphertext   — 600k iterations (OWASP 2023)
 *      "MONTOENC1" | salt (16) | iv (12) | ciphertext   — 310k, read only; re-saved as ENC2 after unlocking
 *  - Without a password, on the desktop: a random 256-bit key kept in the Windows Credential Manager.
 *      "MONTODEV1" | iv (12) | ciphertext
 */
const enc = (s: string) => new TextEncoder().encode(s);
const MAGIC_V1 = enc('MONTOENC1');
const MAGIC_V2 = enc('MONTOENC2');
const MAGIC_DEV = enc('MONTODEV1');
const ITER: Record<1 | 2, number> = { 1: 310_000, 2: 600_000 };

const subtle = () => globalThis.crypto.subtle;
const starts = (bytes: Uint8Array, magic: Uint8Array) => bytes.length >= magic.length && magic.every((b, i) => bytes[i] === b);

/** Protected by the user's password (needs the lock screen). */
export const isEncrypted = (bytes: Uint8Array) => starts(bytes, MAGIC_V2) || starts(bytes, MAGIC_V1);
/** Protected by this computer's key (opens without asking). */
export const isDeviceEncrypted = (bytes: Uint8Array) => starts(bytes, MAGIC_DEV);

export async function deriveKey(password: string, salt: Uint8Array, iterations = ITER[2]): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', enc(password), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface KeyMaterial { key: CryptoKey; salt: Uint8Array }

export async function newKey(password: string): Promise<KeyMaterial> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { key: await deriveKey(password, salt), salt };
}

export async function encrypt(plain: Uint8Array, km: KeyMaterial): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, km.key, plain as BufferSource));
  const out = new Uint8Array(MAGIC_V2.length + 16 + 12 + ct.length);
  out.set(MAGIC_V2, 0);
  out.set(km.salt, MAGIC_V2.length);
  out.set(iv, MAGIC_V2.length + 16);
  out.set(ct, MAGIC_V2.length + 28);
  return out;
}

export class WrongPasswordError extends Error {
  constructor() { super(tr('Contraseña incorrecta.')); this.name = 'WrongPasswordError'; }
}

/** Decrypt a password file. The key material returned always writes the current format (ENC2). */
export async function decrypt(file: Uint8Array, password: string): Promise<{ plain: Uint8Array; km: KeyMaterial }> {
  const version = starts(file, MAGIC_V2) ? 2 : 1;
  const salt = file.slice(MAGIC_V2.length, MAGIC_V2.length + 16);
  const iv = file.slice(MAGIC_V2.length + 16, MAGIC_V2.length + 28);
  const ct = file.slice(MAGIC_V2.length + 28);
  const key = await deriveKey(password, salt, ITER[version]);
  let plain: Uint8Array;
  try {
    plain = new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv }, key, ct));
  } catch {
    throw new WrongPasswordError();
  }
  // Old 310k files: from now on they are saved with a fresh salt at 600k iterations.
  return { plain, km: version === 2 ? { key, salt } : await newKey(password) };
}

// ------------------------------------------------------------------ device key (no password)
export const importDeviceKey = (base64: string) =>
  subtle().importKey('raw', Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)) as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
export const newDeviceKeyBase64 = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));

export async function encryptDevice(plain: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, plain as BufferSource));
  const out = new Uint8Array(MAGIC_DEV.length + 12 + ct.length);
  out.set(MAGIC_DEV, 0);
  out.set(iv, MAGIC_DEV.length);
  out.set(ct, MAGIC_DEV.length + 12);
  return out;
}

export class ForeignDeviceError extends Error {
  constructor() { super(tr('Este archivo está protegido con la llave de otro equipo o de otra cuenta de Windows. Ábrelo en ese equipo, o usa una copia portátil con contraseña.')); this.name = 'ForeignDeviceError'; }
}

export async function decryptDevice(file: Uint8Array, key: CryptoKey | null): Promise<Uint8Array> {
  if (!key) throw new ForeignDeviceError();
  try {
    return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: file.slice(MAGIC_DEV.length, MAGIC_DEV.length + 12) }, key, file.slice(MAGIC_DEV.length + 12)));
  } catch {
    throw new ForeignDeviceError();
  }
}

/** Where the device key comes from; set once at start-up on the desktop (none in the browser or in tests). */
let provider: (() => Promise<CryptoKey | null>) | null = null;
export const setDeviceKeyProvider = (p: typeof provider) => { provider = p; };
export const deviceKey = (): Promise<CryptoKey | null> => (provider ? provider() : Promise.resolve(null));

// ------------------------------------------------------------------ hashing
export async function sha256Hex(text: string): Promise<string> {
  const h = await subtle().digest('SHA-256', enc(text));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
const PIN_ITER = 210_000;

/** Slow, salted hash for PINs: "pbkdf2$<iterations>$<salt>$<hash>". A 4–6 digit PIN can't resist a fast hash. */
export async function hashSecret(secret: string, iterations = PIN_ITER): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${iterations}$${b64(salt)}$${await pbkdf2(secret, salt, iterations)}`;
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [kind, iter, salt, hash] = stored.split('$');
  if (kind !== 'pbkdf2' || !salt || !hash) return false;
  const got = await pbkdf2(secret, Uint8Array.from(atob(salt), (c) => c.charCodeAt(0)), Number(iter));
  // Constant-time comparison.
  let diff = got.length ^ hash.length;
  for (let i = 0; i < Math.min(got.length, hash.length); i++) diff |= got.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

async function pbkdf2(secret: string, salt: Uint8Array, iterations: number): Promise<string> {
  const base = await subtle().importKey('raw', enc(secret), 'PBKDF2', false, ['deriveBits']);
  return b64(await subtle().deriveBits({ name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' }, base, 256));
}

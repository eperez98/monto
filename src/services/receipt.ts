/** Read a receipt photo on this computer (Windows OCR) and turn it into movement fields. */
import { isTauri } from '../db/adapters';
import { parseReceipt, type ReceiptData } from '../domain/receipt';

export const receiptSupported = () => isTauri();
export const RECEIPT_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'heic', 'bmp'];

export async function readReceipt(image: Uint8Array): Promise<ReceiptData> {
  const { invoke } = await import('@tauri-apps/api/core');
  return parseReceipt(await invoke<string[]>('read_receipt', { image: Array.from(image) }));
}

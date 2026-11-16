/** Turns the text read from a receipt photo into the fields of a movement. Anything not found stays empty for the user. */
import { parseAmount } from './bankMail';
import type { ISODate } from '../lib/dates';

export interface ReceiptData { merchant: string; amount: number | null; date: ISODate | null }

const NUM = /(\d{1,3}(?:[.,]\d{3})*[.,]\d{2}|\d+[.,]\d{2})(?!\d)/g;
// "TOTAL", "TOTAL A PAGAR", "MONTO TOTAL", "IMPORTE"; never SUBTOTAL or the tax/item lines.
const TOTAL = /^(?:total(?!\s*(?:itbms|impuesto|items?|art))|monto total|importe total|total a pagar|importe)\b/i;
const NOT_NAME = /^(ruc|r\.u\.c|dv|fecha|factura|fact|tel|telefono|teléfono|cajero|caja|recibo|comprobante|cliente|nit|no\.?|n°|#)\b/i;

const amounts = (l: string) => [...l.matchAll(NUM)].map((m) => parseAmount(m[1])).filter((v) => v > 0);

function findDate(text: string): ISODate | null {
  const iso = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  const dmy = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  const [y, m, d] = iso ? [+iso[1], +iso[2], +iso[3]] : dmy ? [+dmy[3] < 100 ? 2000 + +dmy[3] : +dmy[3], +dmy[2], +dmy[1]] : [0, 0, 0];
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseReceipt(lines: string[]): ReceiptData {
  const clean = lines.map((l) => l.replace(/\s*\/\s*\.\s*/g, '/. ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const totalLine = clean.find((l) => TOTAL.test(l) && amounts(l).length);
  // No TOTAL line read: the largest amount on a receipt is almost always the total.
  const amount = totalLine ? amounts(totalLine).at(-1)! : Math.max(0, ...clean.flatMap(amounts)) || null;
  const merchant = clean.find((l) => !NOT_NAME.test(l) && (l.match(/[a-záéíóúñ]/gi)?.length ?? 0) >= 3 && !amounts(l).length) ?? '';
  return { merchant: merchant.slice(0, 60), amount, date: findDate(clean.join('\n')) };
}

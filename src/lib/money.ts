
import { tr } from './i18n';/**
 * Money helpers. All amounts are stored as integer cents to avoid floating
 * point errors. PAB (Balboa) and USD trade at a fixed 1:1 parity, but the
 * currency code is always preserved so both can be displayed separately.
 */
export type Currency = 'PAB' | 'USD' | 'COP';

export const CURRENCIES: Record<Currency, { code: Currency; symbol: string; name: string; country: string }> = {
  PAB: { code: 'PAB', symbol: 'B/.', name: tr('Balboa'), country: tr('Panamá') },
  USD: { code: 'USD', symbol: '$', name: tr('Dólar estadounidense'), country: tr('Estados Unidos') },
  COP: { code: 'COP', symbol: '$', name: tr('Peso colombiano'), country: tr('Colombia') },
};

/**
 * Fixed parity PAB:USD = 1:1 (Panamanian monetary system). Pesos never mix with them: a Colombian profile keeps
 * every account in COP (see domain/countries), so no exchange rate is ever needed.
 */
export const PARITY: Record<Currency, number> = { PAB: 1, USD: 1, COP: 1 };

const nf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
// Pesos the Colombian way: "$ 45.000", and "$ 45.000,50" only when there are cents.
const cop = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function formatMoney(cents: number, currency: Currency = 'PAB', opts: { compact?: boolean; sign?: boolean } = {}): string {
  const sym = CURRENCIES[currency]?.symbol ?? currency;
  const neg = cents < 0;
  const abs = Math.abs(cents) / 100;
  const body = opts.compact && abs >= 10000 ? compact(abs) : currency === 'COP' ? cop.format(abs) : opts.compact && Number.isInteger(abs) ? nf0.format(abs) : nf.format(abs);
  const sep = currency === 'USD' ? '' : ' ';
  const sign = neg ? '−' : opts.sign && cents > 0 ? '+' : '';
  return `${sign}${sym}${sep}${body}`;
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
}

/**
 * Parse user input like "1,500.50", "B/. 20", "$3" into cents. Returns NaN if invalid.
 * Also the Colombian style: "45.000" (dots group thousands) and "45.000,50" (comma for cents).
 */
export function parseMoney(input: string | number): number {
  if (typeof input === 'number') return Math.round(input * 100);
  let raw = input.replace(/B\/\.|\$|PAB|USD|COP|\s/gi, '').trim();
  if (/^-?\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(raw) || /^-?\d+,\d{1,2}$/.test(raw)) raw = raw.replace(/\./g, '').replace(',', '.');
  const cleaned = raw.replace(/,/g, '');
  if (cleaned === '' || !/^-?\d*(\.\d{0,2})?$/.test(cleaned) || cleaned === '-' || cleaned === '.') return NaN;
  return Math.round(parseFloat(cleaned) * 100);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Convert between currencies using the fixed parity. */
export function convert(cents: number, from: Currency, to: Currency): number {
  return Math.round((cents * PARITY[from]) / PARITY[to]);
}

export interface CurrencyTotals { PAB: number; USD: number; COP: number }
export const zeroTotals = (): CurrencyTotals => ({ PAB: 0, USD: 0, COP: 0 });

/** Combined total in `display` currency: balboas and dollars at par; pesos only add up with pesos. */
export function combined(t: Partial<CurrencyTotals>, display: Currency = 'PAB'): number {
  if (display === 'COP') return t.COP ?? 0;
  return convert(t.PAB ?? 0, 'PAB', display) + convert(t.USD ?? 0, 'USD', display);
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return (part / whole) * 100;
}

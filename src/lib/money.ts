
import { tr } from './i18n';

/**
 * Money helpers. All amounts are stored as integer cents to avoid floating
 * point errors. PAB (Balboa) and USD trade at a fixed 1:1 parity, but the
 * currency code is always preserved so both can be displayed separately.
 */
export type Currency = 'PAB' | 'USD' | 'COP' | 'CRC' | 'DOP';
export const CURRENCY_CODES: Currency[] = ['PAB', 'USD', 'COP', 'CRC', 'DOP'];

export const CURRENCIES: Record<Currency, { code: Currency; symbol: string; name: string; country: string }> = {
  PAB: { code: 'PAB', symbol: 'B/.', name: tr('Balboa'), country: tr('Panamá') },
  USD: { code: 'USD', symbol: '$', name: tr('Dólar estadounidense'), country: tr('Estados Unidos') },
  COP: { code: 'COP', symbol: '$', name: tr('Peso colombiano'), country: tr('Colombia') },
  CRC: { code: 'CRC', symbol: '₡', name: tr('Colón costarricense'), country: tr('Costa Rica') },
  DOP: { code: 'DOP', symbol: 'RD$', name: tr('Peso dominicano'), country: tr('República Dominicana') },
};

/** "Balboa (PAB)" and so on, for selects. */
export const currencyLabel = (c: Currency) => `${CURRENCIES[c].name} (${c})`;

// ------------------------------------------------------------------ exchange rates
/**
 * How many units of each local currency buy one US dollar. The balboa is at par by law (1:1). The others are the
 * rate the user types in Settings → Profile; Monto works offline and never looks rates up. Until the user sets one,
 * these rough figures keep totals readable, and the UI says they are an estimate.
 */
export const DEFAULT_RATES: Record<Currency, number> = { PAB: 1, USD: 1, COP: 4000, CRC: 505, DOP: 63 };
export type Rates = Partial<Record<Currency, number>>;
let rates: Record<Currency, number> = { ...DEFAULT_RATES };

/** Use the profile's rates (called when a profile opens and when its rates change). PAB and USD stay at 1. */
export function setRates(r: Rates | undefined) {
  rates = { ...DEFAULT_RATES };
  for (const c of CURRENCY_CODES) {
    const v = r?.[c];
    if (c !== 'PAB' && c !== 'USD' && typeof v === 'number' && v > 0 && Number.isFinite(v)) rates[c] = v;
  }
}
export const rateOf = (c: Currency) => rates[c] ?? 1;

const nf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
// Pesos the Colombian way: "$ 45.000", and "$ 45.000,50" only when there are cents.
const cop = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
// Colones the Costa Rican way: "₡ 12 500" (space for thousands, comma for cents).
const crc = new Intl.NumberFormat('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function formatMoney(cents: number, currency: Currency = 'PAB', opts: { compact?: boolean; sign?: boolean } = {}): string {
  const sym = CURRENCIES[currency]?.symbol ?? currency;
  const neg = cents < 0;
  const abs = Math.abs(cents) / 100;
  const body = opts.compact && abs >= 10000 ? compact(abs) : currency === 'COP' ? cop.format(abs) : currency === 'CRC' ? crc.format(abs) : opts.compact && Number.isInteger(abs) ? nf0.format(abs) : nf.format(abs);
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
  let raw = input.replace(/B\/\.|RD\$|\$|₡|PAB|USD|COP|CRC|DOP|\s/gi, '').trim();
  if (/^-?\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(raw) || /^-?\d+,\d{1,2}$/.test(raw)) raw = raw.replace(/\./g, '').replace(',', '.');
  const cleaned = raw.replace(/,/g, '');
  if (cleaned === '' || !/^-?\d*(\.\d{0,2})?$/.test(cleaned) || cleaned === '-' || cleaned === '.') return NaN;
  return Math.round(parseFloat(cleaned) * 100);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Convert between currencies through the dollar: balboas at par, the others at the profile's rate. */
export function convert(cents: number, from: Currency, to: Currency): number {
  if (from === to) return cents;
  return Math.round((cents / rateOf(from)) * rateOf(to));
}

export type CurrencyTotals = Record<Currency, number>;
export const zeroTotals = (): CurrencyTotals => ({ PAB: 0, USD: 0, COP: 0, CRC: 0, DOP: 0 });

/** Combined total in `display` currency, every currency converted at the profile's rate. */
export function combined(t: Partial<CurrencyTotals>, display: Currency = 'PAB'): number {
  return CURRENCY_CODES.reduce((sum, c) => sum + convert(t[c] ?? 0, c, display), 0);
}

/** A SQL expression for `col` (cents in the row's `currency`) converted to `display`, for sums across currencies. */
export function amountInSql(display: Currency, col = 'amount', currencyCol = 'currency'): string {
  const cases = CURRENCY_CODES.filter((c) => c !== display).map((c) => `WHEN '${c}' THEN ${col} * ${rateOf(display) / rateOf(c)}`).join(' ');
  return `CAST(ROUND(CASE ${currencyCol} ${cases} ELSE ${col} END) AS INTEGER)`;
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return (part / whole) * 100;
}

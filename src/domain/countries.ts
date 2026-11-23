/** Countries Monto supports, their currencies and the banks people there use. */
import type { Currency } from '../lib/money';
import { tr } from '../lib/i18n';

export type Country = 'PA' | 'CO' | 'CR' | 'DO';
export const DEFAULT_COUNTRY: Country = 'PA';

export interface CountryInfo { code: Country; name: () => string; currencies: Currency[]; banks: string[] }

export const COUNTRIES: Record<Country, CountryInfo> = {
  PA: {
    code: 'PA', name: () => tr('Panamá'),
    // Balboa and dollar at par: both can live in the same profile.
    currencies: ['PAB', 'USD'],
    banks: ['Banco General', 'Banistmo', 'BAC Credomatic', 'Banco Nacional de Panamá', 'Caja de Ahorros', 'Global Bank', 'Multibank', 'Banesco', 'St. Georges Bank', 'Credicorp Bank', 'Banco Aliado', 'Towerbank', 'Canal Bank', 'Metrobank', 'Davivienda Panamá'],
  },
  CO: {
    code: 'CO', name: () => tr('Colombia'),
    // Pesos first; dollars too, converted at the rate the user sets (Settings → Profile).
    currencies: ['COP', 'USD'],
    banks: ['Bancolombia', 'Banco de Bogotá', 'Davivienda', 'BBVA Colombia', 'Banco de Occidente', 'Banco Popular', 'Banco AV Villas', 'Banco Caja Social', 'Scotiabank Colpatria', 'Itaú', 'Banco Agrario', 'Banco GNB Sudameris', 'Banco Falabella', 'Banco Pichincha', 'Bancoomeva', 'Nequi', 'Daviplata', 'Nu Colombia', 'Lulo Bank', 'RappiPay'],
  },
  CR: {
    code: 'CR', name: () => tr('Costa Rica'),
    currencies: ['CRC', 'USD'],
    banks: ['Banco Nacional de Costa Rica', 'Banco de Costa Rica', 'BAC Credomatic', 'Banco Popular', 'Davivienda Costa Rica', 'Banco Promerica', 'Banco Lafise', 'Banco BCT', 'Banco Cathay', 'Banco Improsa', 'Coopenae', 'Coopeservidores', 'Grupo Mutual', 'Mutual Alajuela'],
  },
  DO: {
    code: 'DO', name: () => tr('República Dominicana'),
    currencies: ['DOP', 'USD'],
    banks: ['Banco Popular Dominicano', 'Banreservas', 'Banco BHD', 'Scotiabank República Dominicana', 'Banco Santa Cruz', 'Asociación Popular de Ahorros y Préstamos', 'Asociación Cibao', 'Banco Promerica', 'Banesco República Dominicana', 'Banco Caribe', 'Banco López de Haro', 'Banco Vimenca', 'Banco Lafise', 'Qik Banco Digital'],
  },
};

/** The currency a bare amount means in this country's emails and statements ("45.80" with no symbol). */
export const localCurrency = (country?: string): Currency => countryOf(country).currencies[0];
/** Short description shown when choosing the country. */
export function countryHint(country: Country): string {
  return country === 'PA' ? tr('Balboa y dólar a la par.') : country === 'CO' ? tr('Pesos colombianos (COP) y dólares.') : country === 'CR' ? tr('Colones (CRC) y dólares.') : tr('Pesos dominicanos (DOP) y dólares.');
}

/** Online banks and wallets in the United States, in dollars; offered where the profile can hold USD. */
export const US_ONLINE_BANKS = ['Chime', 'SoFi', 'Ally Bank', 'Capital One 360', 'Discover Bank', 'Varo', 'Current', 'Marcus by Goldman Sachs', 'Charles Schwab', 'Revolut', 'Wise', 'PayPal', 'Venmo', 'Cash App', 'Zelle'];

export const countryOf = (c?: string): CountryInfo => COUNTRIES[(c as Country) in COUNTRIES ? (c as Country) : DEFAULT_COUNTRY];

/** Banks to offer when creating an account, grouped for a <select>. */
export function bankGroups(country?: string): Array<{ label: string; banks: string[] }> {
  const c = countryOf(country);
  const groups = [{ label: tr('Bancos de {country}', { country: c.name() }), banks: c.banks }];
  if (c.currencies.includes('USD')) groups.push({ label: tr('Bancos en línea de EE. UU. (USD)'), banks: US_ONLINE_BANKS });
  return groups;
}

/** The right currency for an account at this bank: US online banks are always in dollars. */
export const currencyForBank = (bank: string, fallback: Currency): Currency => (US_ONLINE_BANKS.includes(bank) ? 'USD' : fallback);

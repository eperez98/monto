/** Countries Monto supports, their currencies and the banks people there use. */
import type { Currency } from '../lib/money';
import { tr } from '../lib/i18n';

export type Country = 'PA' | 'CO';
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
    // shortcut: pesos only — mixing COP with dollars needs exchange rates Monto doesn't have offline. Add rates to allow USD here.
    currencies: ['COP'],
    banks: ['Bancolombia', 'Banco de Bogotá', 'Davivienda', 'BBVA Colombia', 'Banco de Occidente', 'Banco Popular', 'Banco AV Villas', 'Banco Caja Social', 'Scotiabank Colpatria', 'Itaú', 'Banco Agrario', 'Banco GNB Sudameris', 'Banco Falabella', 'Banco Pichincha', 'Bancoomeva', 'Nequi', 'Daviplata', 'Nu Colombia', 'Lulo Bank', 'RappiPay'],
  },
};

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

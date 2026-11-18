/** Turn bank notification emails (Gmail / Outlook API objects) into transactions to review. */
import type { Currency } from '../lib/money';
import type { ISODate } from '../lib/dates';

export interface MailMessage { id: string; subject: string; from: string; date: ISODate; text: string }
export interface ParsedTx { amount: number; currency: Currency; type: 'expense' | 'income'; merchant: string; date: ISODate; bank?: string }

const b64url = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));
export const htmlToText = (h: string) => h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
const isoDate = (d: string | number) => { const t = new Date(d); return (Number.isNaN(t.getTime()) ? new Date() : t).toISOString().slice(0, 10); };

interface GmailPart { mimeType?: string; body?: { data?: string }; parts?: GmailPart[] }
/** Gmail `users.messages.get?format=full` → message. Prefers text/plain, falls back to HTML. */
export function fromGmail(m: { id: string; internalDate?: string; payload?: GmailPart & { headers?: Array<{ name: string; value: string }> } }): MailMessage {
  const h = (n: string) => m.payload?.headers?.find((x) => x.name.toLowerCase() === n)?.value ?? '';
  const parts: GmailPart[] = [];
  const walk = (p?: GmailPart) => { if (!p) return; parts.push(p); p.parts?.forEach(walk); };
  walk(m.payload);
  const plain = parts.find((p) => p.mimeType === 'text/plain' && p.body?.data);
  const html = parts.find((p) => p.mimeType === 'text/html' && p.body?.data);
  let text = '';
  try { text = plain ? b64url(plain.body!.data!) : html ? htmlToText(b64url(html.body!.data!)) : ''; } catch { text = ''; }
  return { id: `g:${m.id}`, subject: h('subject'), from: h('from'), date: isoDate(m.internalDate ? Number(m.internalDate) : h('date')), text };
}

/** Microsoft Graph `/me/messages` item → message. */
export function fromGraph(m: { id: string; subject?: string; receivedDateTime?: string; from?: { emailAddress?: { address?: string; name?: string } }; body?: { contentType?: string; content?: string } }): MailMessage {
  const c = m.body?.content ?? '';
  return { id: `m:${m.id}`, subject: m.subject ?? '', from: m.from?.emailAddress?.address ?? '', date: isoDate(m.receivedDateTime ?? ''), text: m.body?.contentType === 'html' ? htmlToText(c) : c };
}

/** "1,234.56", "1.234,56", "45" → cents. */
export function parseAmount(raw: string): number {
  let s = raw.replace(/\s/g, '');
  if (/,\d{2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  // Pesos: "45.000" and "1.250.000" group thousands with dots and carry no cents.
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  else s = s.replace(/,/g, '');
  const v = Math.round(Number(s) * 100);
  return Number.isFinite(v) ? v : NaN;
}

const NUMBER = String.raw`(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)`;
const AMOUNT = new RegExp(String.raw`(B\/\.|PAB|USD|US\$|COP|COL\$|\$)\s?` + NUMBER, 'i');
// Some banks write the amount without a currency: "Monto: 45.80", "Importe de la transacción: 12.00".
const LABELED_AMOUNT = new RegExp(String.raw`(?:monto|importe|valor|total)(?:\s+de\s+la\s+(?:transacci[oó]n|compra|operaci[oó]n))?\s*:\s*()` + NUMBER, 'i');
const INCOME = /(dep[oó]sito|abono|acreditad|acreditaci[oó]n|recibiste|has recibido|te (?:enviaron|envi[oó])|transferencia (?:recibida|entrante)|ach recibid|yappy recibido|reembolso|devoluci[oó]n|cr[eé]dito a (tu|su) cuenta|consignaci[oó]n|you received|received a (?:payment|deposit|transfer)|direct deposit|deposit of|refund|has been credited|sent you)/i;
/** Panama banks by the domain they send alerts from; shown next to each movement found. */
const BANKS: Array<[RegExp, string]> = [
  [/bgeneral\.com/i, 'Banco General'], [/banistmo\.com/i, 'Banistmo'], [/baccredomatic\.com|bac\.net/i, 'BAC Credomatic'], [/globalbank\.com\.pa/i, 'Global Bank'],
  [/cajadeahorros\.com\.pa/i, 'Caja de Ahorros'], [/banconal\.com\.pa/i, 'Banco Nacional'], [/banesco\.com\.pa|banesco\.com/i, 'Banesco'], [/multibank\.com\.pa/i, 'Multibank'],
  [/bancoaliado\.com/i, 'Banco Aliado'], [/towerbank\.com/i, 'Towerbank'], [/credicorpbank\.com/i, 'Credicorp Bank'], [/sgbank\.com|stgeorgesbank\.com/i, 'St. Georges Bank'],
  [/canalbank\.com/i, 'Canal Bank'], [/metrobanksa\.com|metrobank\.com\.pa/i, 'Metrobank'], [/davivienda\.com\.pa/i, 'Davivienda Panamá'], [/yappy/i, 'Yappy'],
  // Colombia
  [/bancolombia\.com/i, 'Bancolombia'], [/bancodebogota\.com/i, 'Banco de Bogotá'], [/davivienda\.com(?!\.pa)/i, 'Davivienda'], [/bbva\.com\.co/i, 'BBVA Colombia'],
  [/bancodeoccidente\.com\.co/i, 'Banco de Occidente'], [/bancopopular\.com\.co/i, 'Banco Popular'], [/avvillas\.com\.co/i, 'Banco AV Villas'], [/bancocajasocial\.com/i, 'Banco Caja Social'],
  [/scotiabankcolpatria\.com/i, 'Scotiabank Colpatria'], [/itau\.co/i, 'Itaú'], [/bancoagrario\.gov\.co/i, 'Banco Agrario'], [/gnbsudameris\.com\.co/i, 'Banco GNB Sudameris'],
  [/bancofalabella\.com\.co/i, 'Banco Falabella'], [/nequi\.com/i, 'Nequi'], [/daviplata\.com/i, 'Daviplata'], [/nu\.com\.co|nubank/i, 'Nu Colombia'], [/lulobank\.com/i, 'Lulo Bank'], [/rappipay|rappi\.com/i, 'RappiPay'],
  // US online banks and wallets
  [/chime\.com/i, 'Chime'], [/sofi\.(?:com|org)/i, 'SoFi'], [/ally\.com/i, 'Ally Bank'], [/capitalone\.com/i, 'Capital One 360'], [/discover\.com/i, 'Discover Bank'], [/varomoney\.com|varo\.com/i, 'Varo'],
  [/current\.com/i, 'Current'], [/marcus\.com/i, 'Marcus by Goldman Sachs'], [/schwab\.com/i, 'Charles Schwab'], [/revolut\.com/i, 'Revolut'], [/wise\.com/i, 'Wise'], [/paypal\.com/i, 'PayPal'],
  [/venmo\.com/i, 'Venmo'], [/cash\.app|square\.com/i, 'Cash App'], [/zellepay\.com/i, 'Zelle'],
];
export const bankFromSender = (from: string) => BANKS.find(([re]) => re.test(from))?.[1];
const NAME = String.raw`([A-Za-z0-9][A-Za-z0-9 &'.*/-]{1,40}?)(?=\s+(?:el|por|con|fecha|monto|tarjeta|a las|hora|on|with|using|for)\b|\s*[,\n]|\.\s|$)`;
const LABELED = new RegExp(String.raw`(?:nombre del comercio|comercio|establecimiento|merchant|lugar|beneficiario|destinatario)\s*:?\s+` + NAME, 'i');
// Weaker labels, used only when none of the above is in the email.
const DESCRIBED = new RegExp(String.raw`(?:descripci[oó]n|detalle)\s*:\s*` + NAME, 'i');
// "en X" / "at X" only after the amount, so "tarjeta terminada en 1234" isn't taken for the merchant.
const AFTER_AMOUNT = new RegExp(String.raw`\b(?:en|at|to|from)\s+` + NAME, 'i');

/** Read amount, direction and merchant from a bank notification. Null when no amount is found. */
/** `dollarSign`: what a bare "$" means — pesos for a Colombian profile, dollars otherwise. */
export function parseBankEmail(msg: Pick<MailMessage, 'subject' | 'text' | 'date'> & { from?: string }, dollarSign: Currency = 'USD'): ParsedTx | null {
  const body = `${msg.subject}\n${msg.text}`;
  const m = AMOUNT.exec(body) ?? LABELED_AMOUNT.exec(body);
  if (!m) return null;
  const amount = parseAmount(m[2]);
  if (!(amount > 0)) return null;
  // No currency written: balboa and dollar are at par in Panama; record it in balboas.
  const sym = m[1] ?? '';
  const currency: Currency = /COP|COL\$/i.test(sym) ? 'COP' : /USD|US\$/i.test(sym) ? 'USD' : sym === '$' ? dollarSign : dollarSign === 'COP' ? 'COP' : 'PAB';
  const afterAmount = body.slice(m.index + m[0].length);
  const merchant = (LABELED.exec(body)?.[1] ?? DESCRIBED.exec(body)?.[1] ?? AFTER_AMOUNT.exec(afterAmount)?.[1] ?? msg.subject).trim().replace(/[.,;:]+$/, '').slice(0, 60) || msg.subject;
  return { amount, currency, type: INCOME.test(body) ? 'income' : 'expense', merchant, date: msg.date, bank: msg.from ? bankFromSender(msg.from) : undefined };
}

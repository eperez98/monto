/** Turn bank notification emails (Gmail / Outlook API objects) into transactions to review. */
import type { Currency } from '../lib/money';
import type { ISODate } from '../lib/dates';

export interface MailMessage { id: string; subject: string; from: string; date: ISODate; text: string }
export interface ParsedTx { amount: number; currency: Currency; type: 'expense' | 'income'; merchant: string; date: ISODate }

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
  else s = s.replace(/,/g, '');
  const v = Math.round(Number(s) * 100);
  return Number.isFinite(v) ? v : NaN;
}

const AMOUNT = /(B\/\.|PAB|USD|US\$|\$)\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i;
const INCOME = /(dep[oó]sito|abono|acreditad|recibiste|has recibido|transferencia recibida|reembolso|devoluci[oó]n|cr[eé]dito a (tu|su) cuenta)/i;
const NAME = String.raw`([A-Za-z0-9][A-Za-z0-9 &'.*/-]{1,40}?)(?=\s+(?:el|por|con|fecha|monto|tarjeta|a las|hora)\b|\s*[,\n]|\.\s|$)`;
const LABELED = new RegExp(String.raw`(?:comercio|establecimiento|merchant|lugar)\s*:?\s+` + NAME, 'i');
// "en X" only after the amount, so "tarjeta terminada en 1234" isn't taken for the merchant.
const AFTER_AMOUNT = new RegExp(String.raw`\ben\s+` + NAME, 'i');

/** Read amount, direction and merchant from a bank notification. Null when no amount is found. */
export function parseBankEmail(msg: Pick<MailMessage, 'subject' | 'text' | 'date'>): ParsedTx | null {
  const body = `${msg.subject}\n${msg.text}`;
  const m = AMOUNT.exec(body);
  if (!m) return null;
  const amount = parseAmount(m[2]);
  if (!(amount > 0)) return null;
  const currency: Currency = /B\/\.|PAB/i.test(m[1]) ? 'PAB' : 'USD';
  const afterAmount = body.slice(m.index + m[0].length);
  const merchant = (LABELED.exec(body)?.[1] ?? AFTER_AMOUNT.exec(afterAmount)?.[1] ?? msg.subject).trim().replace(/[.,;:]+$/, '').slice(0, 60) || msg.subject;
  return { amount, currency, type: INCOME.test(body) ? 'income' : 'expense', merchant, date: msg.date };
}

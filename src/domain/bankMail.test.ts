import { describe, expect, it } from 'vitest';
import { fromGmail, fromGraph, htmlToText, parseAmount, parseBankEmail } from './bankMail';

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('bank emails', () => {
  it('parses amounts in both decimal styles', () => {
    expect(parseAmount('1,234.56')).toBe(123456);
    expect(parseAmount('1.234,56')).toBe(123456);
    expect(parseAmount('45')).toBe(4500);
  });

  it('reads a card purchase as an expense with its merchant', () => {
    const t = parseBankEmail({ subject: 'Notificación de transacción', text: 'Se realizó una compra con tu tarjeta terminada en 1234 por B/. 45.80 en SUPER 99 VIA ESPANA el 14/11/2026.', date: '2026-11-14' });
    expect(t).toEqual({ amount: 4580, currency: 'PAB', type: 'expense', merchant: 'SUPER 99 VIA ESPANA', date: '2026-11-14' });
  });

  it('reads a deposit as income and $ as USD', () => {
    const t = parseBankEmail({ subject: 'Depósito recibido', text: 'Has recibido un depósito de $1,500.00 en tu cuenta de ahorros.', date: '2026-11-15' });
    expect(t).toMatchObject({ amount: 150000, currency: 'USD', type: 'income' });
  });

  it('uses the "Comercio:" field and ignores emails without an amount', () => {
    expect(parseBankEmail({ subject: 'Alerta', text: 'Comercio: UBER *TRIP\nMonto: USD 7.25', date: '2026-11-10' })).toMatchObject({ amount: 725, merchant: 'UBER *TRIP' });
    expect(parseBankEmail({ subject: 'Tu estado de cuenta está listo', text: 'Ingresa a la banca en línea.', date: '2026-11-10' })).toBeNull();
  });

  it('extracts Gmail and Outlook messages', () => {
    const g = fromGmail({ id: 'abc', internalDate: String(Date.UTC(2026, 10, 14, 12)), payload: { headers: [{ name: 'Subject', value: 'Compra' }, { name: 'From', value: 'alertas@banco.com' }], parts: [{ mimeType: 'text/html', body: { data: b64('<p>Compra por <b>B/. 10.00</b></p><p>en CAFÉ</p>') } }] } });
    expect(g).toMatchObject({ id: 'g:abc', subject: 'Compra', date: '2026-11-14' });
    expect(g.text).toContain('B/. 10.00');
    const m = fromGraph({ id: 'x1', subject: 'Compra', receivedDateTime: '2026-11-13T10:00:00Z', from: { emailAddress: { address: 'a@b.com' } }, body: { contentType: 'html', content: 'Monto&nbsp;$5.00<br>Gracias' } });
    expect(m).toMatchObject({ id: 'm:x1', date: '2026-11-13', text: 'Monto $5.00\nGracias' });
    expect(htmlToText('<style>x{}</style>Hola &amp; adiós')).toBe('Hola & adiós');
  });
});

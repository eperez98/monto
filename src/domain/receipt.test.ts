import { describe, expect, it } from 'vitest';
import { parseReceipt } from './receipt';

describe('parseReceipt', () => {
  it('reads merchant, date and total from a supermarket receipt', () => {
    const lines = ['SUPER 99 VIA ESPANA', 'RUC 1234-56-789 DV 01', 'FECHA: 14/11/2026 10:32', 'LECHE IL 2.35', 'PAN BLANCO 1.80', 'SUBTOTAL 9.10', 'ITBMS 0.00', 'TOTAL B/ . 9.10', 'GRACIAS POR SU COMPRA'];
    expect(parseReceipt(lines)).toEqual({ merchant: 'SUPER 99 VIA ESPANA', amount: 910, date: '2026-11-14' });
  });
  it('handles comma decimals, ISO dates and a missing TOTAL line', () => {
    expect(parseReceipt(['Factura 0012', 'Café Unido', '2026-11-03', 'Latte 4,50', 'Croissant 3,25'])).toEqual({ merchant: 'Café Unido', amount: 450, date: '2026-11-03' });
    expect(parseReceipt(['MONTO TOTAL 1.250,00'])).toMatchObject({ amount: 125000, merchant: '' });
  });
  it('leaves everything empty when nothing is readable', () => {
    expect(parseReceipt(['###'])).toEqual({ merchant: '', amount: null, date: null });
  });
});

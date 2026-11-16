import { describe, expect, it } from 'vitest';
import { matchRule } from './rules';

describe('category rules', () => {
  it('matches common Panama businesses ignoring case and accents', () => {
    expect(matchRule('COMPRA SUPER 99 VIA ESPAÑA', 'expense', [])?.categoryName).toBe('Alimentación');
    expect(matchRule('Uber *Trip', 'expense', [])?.categoryName).toBe('Transporte');
    expect(matchRule('Pago Planilla Quincena', 'income', [])?.categoryName).toBe('Salario');
    expect(matchRule('Algo raro', 'expense', [])).toBeUndefined();
  });

  it('puts the user rules first and respects the kind', () => {
    const mine = [{ match: 'super 99', categoryId: 'c-compras', kind: 'expense' as const }];
    expect(matchRule('super 99 albrook', 'expense', mine)?.categoryId).toBe('c-compras');
    expect(matchRule('salario', 'expense', [])).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { toCSV, toMarkdown, type Report } from './export';

const report: Report = {
  title: 'Informe', subtitle: 'Noviembre 2026',
  summary: [{ label: 'Ingresos', value: 'B/. 1,000.00' }],
  tables: [{ name: 'Detalle', columns: [{ key: 'd', label: 'Descripción' }, { key: 'a', label: 'Importe', money: true }], rows: [{ d: 'Super | 99', a: 123456 }, { d: 'Reembolso', a: -500 }] }],
};

describe('exports', () => {
  it('builds Notion-ready Markdown tables with right-aligned money and escaped pipes', () => {
    const md = toMarkdown(report);
    expect(md).toContain('# Informe');
    expect(md).toContain('| Descripción | Importe |');
    expect(md).toContain('| --- | ---: |');
    expect(md).toContain(String.raw`| Super \| 99 | 1,234.56 |`);
    expect(md).toContain('| Reembolso | -5.00 |');
    expect(md).toContain('| **B/. 1,000.00** |');
  });

  it('writes CSV with a BOM and plain decimals', () => {
    const csv = toCSV(report.tables[0]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Super | 99,1234.56');
  });

  it('neutralizes spreadsheet formulas in CSV text but keeps negative amounts numeric', () => {
    const csv = toCSV({ name: 'x', columns: [{ key: 'd', label: 'D' }, { key: 'a', label: 'A', money: true }], rows: [{ d: '=HYPERLINK("http://x","y")', a: -500 }, { d: '@SUM(A1)', a: 100 }, { d: '-12', a: 1 }] });
    expect(csv).toContain(`"'=HYPERLINK(""http://x"",""y"")",-5.00`);
    expect(csv).toContain("'@SUM(A1),1.00");
    expect(csv).toContain('\r\n-12,0.01');
  });
});

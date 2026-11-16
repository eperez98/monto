/** Automatic categories: "if the description contains X, it's category Y". */

/** A user rule points at a category id; built-in rules point at a seeded category name. */
export interface CategoryRule { match: string; categoryId?: string; categoryName?: string; kind?: 'expense' | 'income' }

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Common businesses in Panama, used when none of the user's own rules match. */
export const DEFAULT_RULES: CategoryRule[] = [
  ...['super 99', 'riba smith', 'el rey', 'xtra', 'machetazo', 'pricesmart', 'mcdonald', 'kfc', 'pedidosya', 'appetito', 'domino', 'subway', 'starbucks'].map((match) => ({ match, categoryName: 'Alimentación', kind: 'expense' as const })),
  ...['uber', 'cabify', 'indrive', 'panapass', 'metro de panama', 'terpel', 'delta', 'puma energy', 'shell', 'texaco'].map((match) => ({ match, categoryName: 'Transporte', kind: 'expense' as const })),
  ...['ensa', 'naturgy', 'edemet', 'edechi', 'idaan', 'tropigas'].map((match) => ({ match, categoryName: 'Servicios básicos', kind: 'expense' as const })),
  ...['cable & wireless', 'cable and wireless', '+movil', 'mas movil', 'tigo', 'claro', 'digicel'].map((match) => ({ match, categoryName: 'Internet y telefonía', kind: 'expense' as const })),
  ...['netflix', 'spotify', 'disney', 'hbo', 'youtube', 'prime video', 'cinepolis', 'steam', 'playstation', 'xbox', 'apple.com'].map((match) => ({ match, categoryName: 'Entretenimiento', kind: 'expense' as const })),
  ...['farmacia', 'arrocha', 'metro plus', 'felipe rodriguez', 'clinica', 'hospital'].map((match) => ({ match, categoryName: 'Salud', kind: 'expense' as const })),
  ...['amazon', 'aliexpress', 'shein', 'multiplaza', 'albrook', 'conway', 'zara'].map((match) => ({ match, categoryName: 'Compras', kind: 'expense' as const })),
  ...['salario', 'nomina', 'planilla', 'payroll'].map((match) => ({ match, categoryName: 'Salario', kind: 'income' as const })),
];

/** The first rule whose text appears in the description (user rules first), for the given kind. */
export function matchRule(description: string, kind: 'expense' | 'income', userRules: CategoryRule[]): CategoryRule | undefined {
  const d = fold(description);
  if (!d) return undefined;
  const hit = (r: CategoryRule) => (!r.kind || r.kind === kind) && fold(r.match).length > 1 && d.includes(fold(r.match));
  return userRules.find(hit) ?? DEFAULT_RULES.find(hit);
}

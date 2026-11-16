import { useState } from 'react';
import { useCan, useMutate, useQuery } from '../../hooks/useDb';
import { listCategories } from '../../db/repo/finance';
import { getCategoryRules, saveCategoryRules } from '../../db/repo/rules';
import { Button, Card, CardHeader, Input, Segmented, Select, IconButton } from '../../components/ui';
import { tr } from '../../lib/i18n';

/** "If the description contains X, use category Y" — applied to new transactions without a category. */
export function RulesCard() {
  const can = useCan('category.manage');
  const mutate = useMutate();
  const rules = useQuery((e) => getCategoryRules(e));
  const cats = useQuery((e) => listCategories(e));
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [match, setMatch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const options = cats.filter((c) => c.kind === kind);
  const add = () => {
    if (mutate((e, a) => saveCategoryRules(e, a, [{ match: match.trim(), categoryId, kind }, ...rules]), tr('Regla agregada')) !== undefined) { setMatch(''); setCategoryId(''); }
  };
  return (
    <Card hover={false} className="mt-5">
      <CardHeader title={tr('Reglas automáticas')} subtitle={tr('Si la descripción de un movimiento contiene un texto, Monto le pone la categoría. Se aplican a los movimientos nuevos sin categoría, también los importados de CSV o del correo. Si ninguna tuya coincide, Monto usa una lista de comercios comunes de Panamá.')} />
      <div className="p-5 pt-3 space-y-4">
        {can && (
          <form className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_auto] gap-2 items-center" onSubmit={(ev) => { ev.preventDefault(); add(); }}>
            <Segmented size="sm" value={kind} onChange={(v) => { setKind(v); setCategoryId(''); }} options={[{ value: 'expense', label: tr('Gasto') }, { value: 'income', label: tr('Ingreso') }]} />
            <Input value={match} onChange={(ev) => setMatch(ev.target.value)} placeholder={tr('Si dice… (ej. Super 99)')} aria-label={tr('Texto de la regla')} />
            <Select value={categoryId} onChange={(ev) => setCategoryId(ev.target.value)} aria-label={tr('Categoría de la regla')}><option value="">{tr('Categoría…')}</option>{options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
            <Button type="submit" size="sm" icon="plus" disabled={match.trim().length < 2 || !categoryId}>{tr('Agregar')}</Button>
          </form>
        )}
        <ul className="divide-y divide-line/60 rounded-[16px] border border-line/70">
          {rules.map((r, i) => (
            <li key={`${r.match}-${i}`} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
              <span className="flex-1 truncate">{tr('Si dice «{match}»', { match: r.match })}</span>
              <span className="text-muted truncate">→ {cats.find((c) => c.id === r.categoryId)?.name ?? tr('(categoría borrada)')}</span>
              {can && <IconButton icon="trash" size={30} label={tr('Quitar regla')} onClick={() => mutate((e, a) => saveCategoryRules(e, a, rules.filter((_, j) => j !== i)), tr('Regla quitada'))} />}
            </li>
          ))}
          {!rules.length && <li className="px-4 py-3 text-[12.5px] text-muted">{tr('Aún no tienes reglas propias. Se usan las de comercios comunes.')}</li>}
        </ul>
      </div>
    </Card>
  );
}

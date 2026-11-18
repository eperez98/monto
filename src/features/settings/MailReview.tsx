import { useState } from 'react';
import clsx from 'clsx';
import { useApp } from '../../store/app';
import { useMutate } from '../../hooks/useDb';
import { Badge, Button, Input, Money } from '../../components/ui';
import { importMailTransactions, type MailSyncResult } from '../../services/mail';
import { formatDate } from '../../lib/dates';
import { tr } from '../../lib/i18n';

/** What a sync found: totals, then each transaction to pick and rename. Duplicates are shown but can't be added. */
export function MailReview({ result, accountId, onDone }: { result: MailSyncResult; accountId: string; onDone: (left: MailSyncResult) => void }) {
  const mutate = useMutate();
  const toast = useApp((s) => s.toast);
  const fresh = result.candidates.filter((c) => !c.duplicate);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(fresh.map((c) => c.key)));
  const [names, setNames] = useState<Record<string, string>>(() => Object.fromEntries(result.candidates.map((c) => [c.key, c.name])));
  const dups = result.candidates.length - fresh.length;

  const add = () => {
    const chosen = fresh.filter((c) => picked.has(c.key)).map((c) => ({ ...c, name: names[c.key] ?? c.name }));
    const n = mutate((e, a) => importMailTransactions(e, a, chosen, accountId));
    if (n === undefined) return;
    toast({ kind: 'success', title: tr('{n} movimiento(s) agregado(s)', { n }) });
    onDone({ ...result, candidates: result.candidates.filter((c) => !picked.has(c.key) || c.duplicate) });
  };

  return (
    <div>
      <p className="px-3 text-[12.5px] text-ink-2" aria-label={tr('Resultado de la búsqueda')}>
        {tr('{read} correo(s) leído(s) · {fresh} movimiento(s) nuevo(s) · {dups} duplicado(s) · {noAmount} sin monto · {old} ya importado(s)', { read: result.read, fresh: fresh.length, dups, noAmount: result.noAmount, old: result.alreadyImported })}
      </p>
      {!result.candidates.length && <p className="px-3 py-3 text-[12.5px] text-muted">{tr('No hay movimientos nuevos en tus correos.')}</p>}
      <ul className="mt-2 space-y-1" aria-label={tr('Movimientos encontrados')}>
        {result.candidates.map((c) => (
          <li key={c.key} className={clsx('flex flex-wrap items-center gap-3 rounded-[14px] px-3 py-2', c.duplicate ? 'opacity-60' : 'hover:bg-surface-2')}>
            <input type="checkbox" className="size-4 accent-brand" disabled={c.duplicate} checked={!c.duplicate && picked.has(c.key)} aria-label={tr('Agregar {name}', { name: names[c.key] })}
              onChange={(ev) => { const p = new Set(picked); if (ev.target.checked) p.add(c.key); else p.delete(c.key); setPicked(p); }} />
            <span className="min-w-[180px] flex-1">
              {c.duplicate
                ? <span className="block text-[13px] font-medium truncate">{c.name}</span>
                : <Input value={names[c.key] ?? ''} onChange={(ev) => setNames({ ...names, [c.key]: ev.target.value })} aria-label={tr('Nombre del movimiento')} className="!h-9" />}
              <span className="block text-[11.5px] text-muted truncate mt-0.5">{formatDate(c.tx.date)}{c.tx.bank && ` · ${c.tx.bank}`} · {c.subject}</span>
            </span>
            {c.duplicate && <Badge tone="amber">{tr('Duplicado: ya está en tus movimientos')}</Badge>}
            <Money cents={c.tx.type === 'income' ? c.tx.amount : -c.tx.amount} currency={c.tx.currency} sign className={clsx('w-28 text-right text-[13px] font-semibold', c.tx.type === 'income' ? 'text-emerald' : 'text-ink')} />
          </li>
        ))}
      </ul>
      {!!fresh.length && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-3">
          {!accountId ? <p className="text-[12px] text-coral">{tr('Elige la cuenta donde se registran.')}</p> : <span />}
          <Button icon="plus" disabled={!picked.size || !accountId} onClick={add}>{tr('Agregar seleccionados ({n})', { n: [...picked].filter((k) => fresh.some((c) => c.key === k)).length })}</Button>
        </div>
      )}
    </div>
  );
}

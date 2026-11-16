import { useState } from 'react';
import clsx from 'clsx';
import { useApp } from '../../store/app';
import { useCan, useEngine, useMutate, useQuery, errorMessage } from '../../hooks/useDb';
import { listAccounts } from '../../db/repo/finance';
import { Badge, Button, Card, CardHeader, Field, Input, Money, Segmented, Select } from '../../components/ui';
import { Icon } from '../../icons';
import { getMailPrefs, importMailTransactions, mailSupported, readMailTransactions, saveMailPrefs, type MailCandidate, type MailPrefs } from '../../services/mail';
import { formatDate } from '../../lib/dates';
import { tr } from '../../lib/i18n';

/** Optional bank-email reading. Nothing to connect permanently: each search signs in and forgets the access. */
export function MailTab() {
  const e = useEngine();
  const can = useCan('account.manage');
  const mutate = useMutate();
  const toast = useApp((s) => s.toast);
  const saved = useQuery((en) => getMailPrefs(en));
  const accounts = useQuery((en) => listAccounts(en));
  const [prefs, setPrefs] = useState<MailPrefs>(saved);
  // Only in memory while this screen is open; never written anywhere.
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<MailCandidate[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const set = (p: Partial<MailPrefs>) => { const next = { ...prefs, ...p }; setPrefs(next); if (can) mutate((en, a) => saveMailPrefs(en, a, next)); };

  if (!mailSupported()) {
    return <Card hover={false} className="p-6"><p className="text-[14px] font-semibold">{tr('Correo del banco')}{' '}<Badge>{tr('Opcional')}</Badge></p><p className="text-[12.5px] text-muted mt-1">{tr('Disponible en la app de escritorio de Monto.')}</p></Card>;
  }

  const search = async () => {
    setBusy(true);
    try { const r = await readMailTransactions(e, prefs, secret); setFound(r); setPicked(new Set(r.map((c) => c.key))); }
    catch (x) { toast({ kind: 'error', title: tr('No se pudo leer el correo'), body: errorMessage(x) }); }
    setBusy(false);
  };
  const addPicked = () => {
    if (!found || !prefs.accountId) return;
    const n = mutate((en, a) => importMailTransactions(en, a, found.filter((c) => picked.has(c.key)), prefs.accountId));
    if (n !== undefined) { toast({ kind: 'success', title: tr('{n} movimiento(s) agregado(s)', { n }) }); setFound(found.filter((c) => !picked.has(c.key))); setPicked(new Set()); }
  };
  const ready = prefs.clientId.trim() && prefs.subject.trim() && (prefs.provider === 'microsoft' || secret.trim());

  return (
    <div className="space-y-5">
      <Card hover={false} className="p-6">
        <div className="flex items-start gap-4">
          <span className="grid place-items-center size-11 shrink-0 rounded-full bg-brand-soft text-brand"><Icon name="bell" size={20} /></span>
          <div className="flex-1">
            <p className="text-[14px] font-semibold flex items-center gap-2">{tr('Correo del banco')}<Badge>{tr('Opcional')}</Badge></p>
            <p className="text-[12.5px] text-muted mt-1">{tr('Monto puede leer, solo en modo lectura, los avisos de transacción de tu banco y convertirlos en movimientos. Solo toma el asunto, la fecha y el texto de esos correos; no guarda la conexión, ni tokens, ni contraseñas: cada búsqueda vuelve a pedirte iniciar sesión.')}</p>
          </div>
        </div>
        <div className="mt-5 space-y-4">
          <Segmented value={prefs.provider} onChange={(v) => set({ provider: v })} options={[{ value: 'google', label: 'Google (Gmail)' }, { value: 'microsoft', label: 'Microsoft (Outlook)' }]} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={tr('ID de cliente (Client ID)')} hint={tr('Es un identificador público de tu app, no una contraseña.')}>
              <Input value={prefs.clientId} disabled={!can} onChange={(ev) => setPrefs({ ...prefs, clientId: ev.target.value })} onBlur={() => set({})} placeholder={prefs.provider === 'google' ? '1234-abc.apps.googleusercontent.com' : '00000000-0000-0000-0000-000000000000'} />
            </Field>
            {prefs.provider === 'google' && (
              <Field label={tr('Secreto de cliente (Client secret)')} hint={tr('No se guarda: escríbelo cada vez que busques.')}>
                <Input type="password" autoComplete="off" value={secret} onChange={(ev) => setSecret(ev.target.value)} disabled={!can} />
              </Field>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label={tr('El asunto contiene')} hint={tr('Copia el asunto que usa tu banco en sus avisos de transacción.')} className="sm:col-span-2">
              <Input value={prefs.subject} disabled={!can} placeholder={tr('Ej. Notificación de transacción')} onChange={(ev) => setPrefs({ ...prefs, subject: ev.target.value })} onBlur={() => set({})} />
            </Field>
            <Field label={tr('Buscar en los últimos')}>
              <Select value={prefs.days} disabled={!can} onChange={(ev) => set({ days: Number(ev.target.value) })}>{[7, 30, 90].map((d) => <option key={d} value={d}>{tr('{n} días', { n: d })}</option>)}</Select>
            </Field>
          </div>
          <Field label={tr('Cuenta donde se registran')}>
            <Select value={prefs.accountId} disabled={!can} onChange={(ev) => set({ accountId: ev.target.value })}><option value="">—</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
          </Field>
          <details className="rounded-[16px] border border-line/70 px-4 py-3 text-[12.5px] text-ink-2">
            <summary className="cursor-pointer font-medium text-ink">{tr('Cómo obtener el ID de cliente')}</summary>
            {prefs.provider === 'google' ? (
              <ol className="list-decimal pl-5 mt-2 space-y-1">
                <li>{tr('Entra a console.cloud.google.com y crea un proyecto (por ejemplo «Monto»).')}</li>
                <li>{tr('En «APIs y servicios → Biblioteca», activa la Gmail API.')}</li>
                <li>{tr('En «Pantalla de consentimiento de OAuth» elige «Externo», deja la app en modo de prueba y agrega tu correo como usuario de prueba.')}</li>
                <li>{tr('En «Credenciales → Crear credenciales → ID de cliente de OAuth» elige «App de escritorio».')}</li>
                <li>{tr('Copia aquí el ID de cliente. El secreto lo escribes cuando busques.')}</li>
              </ol>
            ) : (
              <ol className="list-decimal pl-5 mt-2 space-y-1">
                <li>{tr('Entra a portal.azure.com → «Registros de aplicaciones» → «Nuevo registro».')}</li>
                <li>{tr('En tipos de cuenta elige «Cuentas de cualquier directorio y cuentas personales de Microsoft».')}</li>
                <li>{tr('En «URI de redirección» elige «Cliente público/nativo (móvil y escritorio)» y escribe http://127.0.0.1')}</li>
                <li>{tr('En «Permisos de API» agrega Microsoft Graph → permisos delegados → Mail.Read.')}</li>
                <li>{tr('Copia aquí el «Id. de aplicación (cliente)». No hace falta secreto.')}</li>
              </ol>
            )}
          </details>
        </div>
      </Card>

      <Card hover={false}>
        <CardHeader title={tr('Movimientos encontrados')} subtitle={tr('Revisa y elige cuáles agregar. Cada correo se agrega una sola vez.')}
          action={<Button size="sm" icon="lock" loading={busy} disabled={!can || !ready} onClick={() => void search()}>{tr('Iniciar sesión y buscar')}</Button>} />
        <div className="p-3">
          {busy && <p className="px-3 pb-2 text-[12px] text-muted">{tr('Se abrió tu navegador. Inicia sesión y acepta el permiso de lectura; luego vuelve a Monto.')}</p>}
          {found === null && !busy && <p className="px-3 py-3 text-[12.5px] text-muted">{tr('Completa los datos de arriba y pulsa «Iniciar sesión y buscar». Al terminar, Monto olvida el acceso.')}</p>}
          {found?.length === 0 && <p className="px-3 py-3 text-[12.5px] text-muted">{tr('No hay correos nuevos de transacciones con ese asunto.')}</p>}
          {!!found?.length && (
            <>
              <ul className="space-y-1">
                {found.map((c) => (
                  <li key={c.key}>
                    <label className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 hover:bg-surface-2 cursor-pointer">
                      <input type="checkbox" className="size-4 accent-brand" checked={picked.has(c.key)} onChange={(ev) => { const p = new Set(picked); if (ev.target.checked) p.add(c.key); else p.delete(c.key); setPicked(p); }} />
                      <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium truncate">{c.tx.merchant}</span><span className="block text-[11.5px] text-muted truncate">{formatDate(c.tx.date)} · {c.subject}</span></span>
                      <Money cents={c.tx.type === 'income' ? c.tx.amount : -c.tx.amount} currency={c.tx.currency} sign className={clsx('text-[13px] font-semibold', c.tx.type === 'income' ? 'text-emerald' : 'text-ink')} />
                    </label>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-3">
                {!prefs.accountId ? <p className="text-[12px] text-coral">{tr('Elige la cuenta donde se registran.')}</p> : <span />}
                <Button icon="plus" disabled={!picked.size || !prefs.accountId} onClick={addPicked}>{tr('Agregar seleccionados ({n})', { n: picked.size })}</Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

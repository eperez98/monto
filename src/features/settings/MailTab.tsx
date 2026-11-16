import { useState } from 'react';
import clsx from 'clsx';
import { useApp } from '../../store/app';
import { useActor, useCan, useEngine, useMutate, useQuery, errorMessage } from '../../hooks/useDb';
import { listAccounts } from '../../db/repo/finance';
import { Badge, Button, Card, CardHeader, Field, Input, Money, Segmented, Select, Toggle } from '../../components/ui';
import { Icon } from '../../icons';
import { connectMail, disconnectMail, findMailTransactions, getMailConfig, importMailTransactions, mailSupported, saveMailConfig, type MailCandidate, type MailProvider } from '../../services/mail';
import { formatDate } from '../../lib/dates';
import { tr } from '../../lib/i18n';

export function MailTab() {
  const e = useEngine();
  const actor = useActor();
  const can = useCan('account.manage');
  const mutate = useMutate();
  const toast = useApp((s) => s.toast);
  const cfg = useQuery((en) => getMailConfig(en));
  const accounts = useQuery((en) => listAccounts(en));
  const [provider, setProvider] = useState<MailProvider>(cfg.provider);
  const [clientId, setClientId] = useState(cfg.clientId);
  const [secret, setSecret] = useState(cfg.clientSecret);
  const [busy, setBusy] = useState<'' | 'connect' | 'search'>('');
  const [found, setFound] = useState<MailCandidate[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const connected = !!cfg.refreshToken;
  const set = (p: Parameters<typeof saveMailConfig>[2]) => mutate((en, a) => saveMailConfig(en, a, p));

  if (!mailSupported()) {
    return <Card hover={false} className="p-6"><p className="text-[14px] font-semibold">{tr('Correo del banco')}</p><p className="text-[12.5px] text-muted mt-1">{tr('Disponible en la app de escritorio de Monto.')}</p></Card>;
  }

  const connect = async () => {
    setBusy('connect');
    try { await connectMail(e, actor, provider, clientId, secret); toast({ kind: 'success', title: tr('Correo conectado') }); }
    catch (x) { toast({ kind: 'error', title: tr('No se pudo conectar el correo'), body: errorMessage(x) }); }
    setBusy('');
  };
  const search = async () => {
    setBusy('search');
    try { const r = await findMailTransactions(e); setFound(r); setPicked(new Set(r.map((c) => c.message.id))); }
    catch (x) { toast({ kind: 'error', title: tr('No se pudo leer el correo'), body: errorMessage(x) }); }
    setBusy('');
  };
  const addPicked = () => {
    if (!found || !cfg.accountId) return;
    const n = mutate((en, a) => importMailTransactions(en, a, found.filter((c) => picked.has(c.message.id)), cfg.accountId));
    if (n !== undefined) { toast({ kind: 'success', title: tr('{n} movimiento(s) agregado(s)', { n }) }); setFound(found.filter((c) => !picked.has(c.message.id))); setPicked(new Set()); }
  };

  return (
    <div className="space-y-5">
      <Card hover={false} className="p-6">
        <div className="flex items-start gap-4">
          <span className="grid place-items-center size-11 shrink-0 rounded-full bg-brand-soft text-brand"><Icon name="bell" size={20} /></span>
          <div className="flex-1">
            <p className="text-[14px] font-semibold flex items-center gap-2">{tr('Correo del banco')}{connected && <Badge tone="green">{tr('Conectado')}</Badge>}</p>
            <p className="text-[12.5px] text-muted mt-1">{tr('Monto lee, solo en modo lectura, los correos de tu banco cuyo asunto indiques y los convierte en movimientos. El acceso se guarda en este equipo y nada se envía a otros servidores.')}</p>
          </div>
        </div>
        <div className="mt-5 space-y-4">
          <Segmented value={provider} onChange={setProvider} options={[{ value: 'google', label: 'Google (Gmail)' }, { value: 'microsoft', label: 'Microsoft (Outlook)' }]} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={tr('ID de cliente (Client ID)')}><Input value={clientId} onChange={(ev) => setClientId(ev.target.value)} disabled={!can} placeholder={provider === 'google' ? '1234-abc.apps.googleusercontent.com' : '00000000-0000-0000-0000-000000000000'} /></Field>
            {provider === 'google' && <Field label={tr('Secreto de cliente (Client secret)')}><Input type="password" value={secret} onChange={(ev) => setSecret(ev.target.value)} disabled={!can} /></Field>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon="lock" loading={busy === 'connect'} disabled={!can || !clientId.trim() || (provider === 'google' && !secret.trim())} onClick={() => void connect()}>
              {connected ? tr('Volver a conectar') : provider === 'google' ? tr('Conectar con Google') : tr('Conectar con Microsoft')}
            </Button>
            {connected && can && <Button variant="ghost" onClick={() => mutate((en, a) => disconnectMail(en, a), tr('Correo desconectado'))}>{tr('Desconectar')}</Button>}
          </div>
          {!e.encrypted && <p className="text-[12px] text-amber">{tr('Recomendado: pon una contraseña a Monto (Configuración → Seguridad). Así el acceso a tu correo queda cifrado en este equipo y en tus copias.')}</p>}
          {busy === 'connect' && <p className="text-[12px] text-muted">{tr('Se abrió tu navegador. Inicia sesión y acepta el permiso de lectura; luego vuelve a Monto.')}</p>}
          <details className="rounded-[16px] border border-line/70 px-4 py-3 text-[12.5px] text-ink-2">
            <summary className="cursor-pointer font-medium text-ink">{tr('Cómo obtener el ID de cliente')}</summary>
            {provider === 'google' ? (
              <ol className="list-decimal pl-5 mt-2 space-y-1">
                <li>{tr('Entra a console.cloud.google.com y crea un proyecto (por ejemplo «Monto»).')}</li>
                <li>{tr('En «APIs y servicios → Biblioteca», activa la Gmail API.')}</li>
                <li>{tr('En «Pantalla de consentimiento de OAuth» elige «Externo», deja la app en modo de prueba y agrega tu correo como usuario de prueba.')}</li>
                <li>{tr('En «Credenciales → Crear credenciales → ID de cliente de OAuth» elige «App de escritorio».')}</li>
                <li>{tr('Copia aquí el ID de cliente y el secreto de cliente.')}</li>
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

      <Card hover={false} className="p-6 space-y-4">
        <p className="text-[14px] font-semibold">{tr('Qué correos leer')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label={tr('El asunto contiene')} hint={tr('Copia el asunto que usa tu banco en sus avisos de transacción.')} className="sm:col-span-2">
            <Input defaultValue={cfg.subject} disabled={!can} placeholder={tr('Ej. Notificación de transacción')} onBlur={(ev) => ev.target.value.trim() !== cfg.subject && set({ subject: ev.target.value.trim() })} />
          </Field>
          <Field label={tr('Buscar en los últimos')}>
            <Select value={cfg.days} disabled={!can} onChange={(ev) => set({ days: Number(ev.target.value) })}>{[7, 30, 90].map((d) => <option key={d} value={d}>{tr('{n} días', { n: d })}</option>)}</Select>
          </Field>
        </div>
        <Field label={tr('Cuenta donde se registran')}>
          <Select value={cfg.accountId} disabled={!can} onChange={(ev) => set({ accountId: ev.target.value })}><option value="">—</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
        </Field>
        <Toggle checked={cfg.auto} disabled={!can || !connected || !cfg.accountId || !cfg.subject} onChange={(v) => set({ auto: v })} label={tr('Agregar automáticamente al abrir Monto')}
          description={tr('Cada vez que abras Monto se agregan los movimientos nuevos sin pedirte revisión. Si lo dejas apagado, los revisas aquí antes de agregarlos.')} />
      </Card>

      <Card hover={false}>
        <CardHeader title={tr('Movimientos encontrados')} subtitle={tr('Revisa y elige cuáles agregar. Cada correo se agrega una sola vez.')}
          action={<Button size="sm" icon="refresh" loading={busy === 'search'} disabled={!connected || !cfg.subject} onClick={() => void search()}>{tr('Buscar en mi correo')}</Button>} />
        <div className="p-3">
          {found === null && <p className="px-3 py-3 text-[12.5px] text-muted">{connected ? tr('Pulsa «Buscar en mi correo» para ver los movimientos nuevos.') : tr('Conecta tu correo para empezar.')}</p>}
          {found?.length === 0 && <p className="px-3 py-3 text-[12.5px] text-muted">{tr('No hay correos nuevos de transacciones con ese asunto.')}</p>}
          {!!found?.length && (
            <>
              <ul className="space-y-1">
                {found.map((c) => (
                  <li key={c.message.id}>
                    <label className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 hover:bg-surface-2 cursor-pointer">
                      <input type="checkbox" className="size-4 accent-brand" checked={picked.has(c.message.id)} onChange={(ev) => { const p = new Set(picked); if (ev.target.checked) p.add(c.message.id); else p.delete(c.message.id); setPicked(p); }} />
                      <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium truncate">{c.tx.merchant}</span><span className="block text-[11.5px] text-muted truncate">{formatDate(c.tx.date)} · {c.message.subject}</span></span>
                      <Money cents={c.tx.type === 'income' ? c.tx.amount : -c.tx.amount} currency={c.tx.currency} sign className={clsx('text-[13px] font-semibold', c.tx.type === 'income' ? 'text-emerald' : 'text-ink')} />
                    </label>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-3">
                {!cfg.accountId ? <p className="text-[12px] text-coral">{tr('Elige la cuenta donde se registran.')}</p> : <span />}
                <Button icon="plus" disabled={!picked.size || !cfg.accountId} onClick={addPicked}>{tr('Agregar seleccionados ({n})', { n: picked.size })}</Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

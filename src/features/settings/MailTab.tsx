import { useState } from 'react';
import { useApp } from '../../store/app';
import { useActor, useCan, useEngine, useMutate, useQuery, errorMessage } from '../../hooks/useDb';
import { listAccounts } from '../../db/repo/finance';
import { Badge, Button, Card, CardHeader, Field, Input, Segmented, Select } from '../../components/ui';
import { Icon } from '../../icons';
import { connectMail, disconnectMail, getMailPrefs, mailSupported, saveMailPrefs, syncMail, type MailPrefs } from '../../services/mail';
import { MailReview } from './MailReview';
import { formatDate, today } from '../../lib/dates';
import { locale, tr } from '../../lib/i18n';

/** Optional bank-email sync: connect once, then Monto reads the bank's alerts when it opens. */
export function MailTab() {
  const e = useEngine();
  const actor = useActor();
  const can = useCan('account.manage');
  const mutate = useMutate();
  const toast = useApp((s) => s.toast);
  const review = useApp((s) => s.mailReview);
  const setReview = useApp((s) => s.setMailReview);
  const saved = useQuery((en) => getMailPrefs(en));
  const accounts = useQuery((en) => listAccounts(en));
  const [draft, setDraft] = useState<MailPrefs>(saved);
  // Only in memory while connecting; the desktop side moves it to the Windows vault.
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState<'' | 'connect' | 'sync' | 'off'>('');
  const set = (p: Partial<MailPrefs>) => { setDraft({ ...draft, ...p }); if (saved.connected && can) mutate((en, a) => saveMailPrefs(en, a, p)); };

  if (!mailSupported()) {
    return <Card hover={false} className="p-6"><p className="text-[14px] font-semibold">{tr('Correo del banco')}{' '}<Badge>{tr('Opcional')}</Badge></p><p className="text-[12.5px] text-muted mt-1">{tr('Disponible en la app de escritorio de Monto.')}</p></Card>;
  }

  const run = async (kind: 'connect' | 'sync' | 'off') => {
    setBusy(kind);
    try {
      if (kind === 'off') { await disconnectMail(e, actor); setReview(null); toast({ kind: 'success', title: tr('Correo desconectado') }); }
      else {
        if (kind === 'connect') { await connectMail(e, actor, draft, secret); setSecret(''); toast({ kind: 'success', title: tr('Correo conectado') }); }
        setReview(await syncMail(e));
      }
    } catch (x) { toast({ kind: 'error', title: kind === 'connect' ? tr('No se pudo conectar el correo') : tr('No se pudo leer el correo'), body: errorMessage(x) }); }
    setBusy('');
  };
  const ready = draft.clientId.trim() && draft.subject.trim() && draft.since && (draft.provider === 'microsoft' || secret.trim());

  return (
    <div className="space-y-5">
      <Card hover={false} className="p-6">
        <div className="flex items-start gap-4">
          <span className="grid place-items-center size-11 shrink-0 rounded-full bg-brand-soft text-brand"><Icon name="bell" size={20} /></span>
          <div className="flex-1">
            <p className="text-[14px] font-semibold flex flex-wrap items-center gap-2">{tr('Correo del banco')}<Badge>{tr('Opcional')}</Badge>{saved.connected && <Badge tone="green">{tr('Conectado')}</Badge>}</p>
            <p className="text-[12.5px] text-muted mt-1">{tr('Conecta tu correo una vez y Monto buscará los avisos de transacción de tu banco cada vez que lo abras. Solo lee esos correos (asunto, fecha y texto), en modo lectura, y siempre te muestra lo encontrado para que elijas qué agregar.')}</p>
            {saved.connected && saved.lastSync && <p className="text-[11.5px] text-muted mt-1">{tr('Última sincronización: {when}', { when: new Date(saved.lastSync).toLocaleString(locale) })}</p>}
          </div>
        </div>

        {!saved.connected ? (
          <div className="mt-5 space-y-5">
            <div className="space-y-3">
              <p className="text-[13px] font-semibold">{tr('1. Tu cuenta de correo')}</p>
              <Segmented value={draft.provider} onChange={(v) => setDraft({ ...draft, provider: v })} options={[{ value: 'google', label: 'Google (Gmail)' }, { value: 'microsoft', label: 'Microsoft (Outlook)' }]} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={tr('ID de cliente (Client ID)')} hint={tr('Es un identificador público de tu app, no una contraseña.')}>
                  <Input value={draft.clientId} disabled={!can} onChange={(ev) => setDraft({ ...draft, clientId: ev.target.value })} placeholder={draft.provider === 'google' ? '1234-abc.apps.googleusercontent.com' : '00000000-0000-0000-0000-000000000000'} />
                </Field>
                {draft.provider === 'google' && (
                  <Field label={tr('Secreto de cliente (Client secret)')} hint={tr('Se guarda en el Administrador de credenciales de Windows, no en Monto.')}>
                    <Input type="password" autoComplete="off" value={secret} onChange={(ev) => setSecret(ev.target.value)} disabled={!can} />
                  </Field>
                )}
              </div>
              <GuideDetails provider={draft.provider} />
            </div>
            <div className="space-y-3">
              <p className="text-[13px] font-semibold">{tr('2. ¿Cuál es el asunto de los correos que te envía tu banco cuando haces una transacción?')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label={tr('Asunto')} hint={tr('Cópialo de uno de esos correos. Solo se buscarán los correos con este asunto.')} className="sm:col-span-2">
                  <Input value={draft.subject} disabled={!can} placeholder={tr('Ej. Notificación de transacción')} onChange={(ev) => setDraft({ ...draft, subject: ev.target.value })} />
                </Field>
                <Field label={tr('Buscar desde')} hint={tr('Se leen los correos de esta fecha en adelante.')}>
                  <Input type="date" max={today()} value={draft.since} disabled={!can} onChange={(ev) => setDraft({ ...draft, since: ev.target.value })} />
                </Field>
              </div>
              <Field label={tr('Cuenta donde se registran')}>
                <Select value={draft.accountId} disabled={!can} onChange={(ev) => setDraft({ ...draft, accountId: ev.target.value })}><option value="">—</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button icon="lock" loading={busy === 'connect'} disabled={!can || !ready} onClick={() => void run('connect')}>{draft.provider === 'google' ? tr('Conectar con Google y buscar') : tr('Conectar con Microsoft y buscar')}</Button>
              {busy === 'connect' && <span className="text-[12px] text-muted">{tr('Se abrió tu navegador. Inicia sesión y acepta el permiso de lectura; luego vuelve a Monto.')}</span>}
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label={tr('Asunto')} className="sm:col-span-2"><Input value={draft.subject} disabled={!can} onChange={(ev) => setDraft({ ...draft, subject: ev.target.value })} onBlur={() => set({ subject: draft.subject })} /></Field>
              <Field label={tr('Buscar desde')}><Input type="date" max={today()} value={draft.since} disabled={!can} onChange={(ev) => set({ since: ev.target.value })} /></Field>
            </div>
            <Field label={tr('Cuenta donde se registran')}>
              <Select value={draft.accountId} disabled={!can} onChange={(ev) => set({ accountId: ev.target.value })}><option value="">—</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
            </Field>
            <p className="text-[11.5px] text-muted">{tr('Cuenta: {provider} · buscando correos desde el {date}', { provider: saved.provider === 'google' ? 'Gmail' : 'Outlook', date: formatDate(saved.since) })}</p>
            <div className="flex flex-wrap gap-2">
              <Button icon="refresh" loading={busy === 'sync'} disabled={!can} onClick={() => void run('sync')}>{tr('Sincronizar ahora')}</Button>
              <Button variant="ghost" loading={busy === 'off'} disabled={!can} onClick={() => void run('off')}>{tr('Desconectar')}</Button>
            </div>
          </div>
        )}
      </Card>

      {review && (
        <Card hover={false}>
          <CardHeader title={tr('Resultado')} subtitle={tr('Elige qué movimientos agregar y cambia el nombre si quieres. Los duplicados no se modifican.')} />
          <div className="p-3"><MailReview key={review.read + ':' + review.candidates.length} result={review} accountId={saved.accountId || draft.accountId} onDone={setReview} /></div>
        </Card>
      )}
    </div>
  );
}

function GuideDetails({ provider }: { provider: 'google' | 'microsoft' }) {
  return (
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
  );
}

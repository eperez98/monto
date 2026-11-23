import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../store/app';
import { useEngine, errorMessage } from '../../hooks/useDb';
import { Button, Card, ChoiceCard, Field, Input, Modal } from '../../components/ui';
import { IconTile } from '../../icons';
import { disableSync, enableSync, getSyncState, pickSyncFolder, runSync, syncSupported, type SyncOutcome } from '../../services/sync';
import { locale, tr } from '../../lib/i18n';

const DONE: Partial<Record<SyncOutcome, string>> = { pushed: tr('Datos subidos a la carpeta'), pulled: tr('Datos traídos de la carpeta'), unchanged: tr('Todo al día') };

/** Both copies changed: the user keeps one. The other is not lost (a backup is made before replacing local data). */
export function SyncChoice({ open, onClose }: { open: boolean; onClose: () => void }) {
  const e = useEngine();
  const toast = useApp((s) => s.toast);
  const [busy, setBusy] = useState(false);
  const pick = async (mode: 'keep-remote' | 'keep-local') => {
    setBusy(true);
    try { const r = await runSync(e, mode); if (r && DONE[r]) toast({ kind: 'success', title: DONE[r]! }); onClose(); } catch (x) { toast({ kind: 'error', title: tr('No se pudo sincronizar'), body: errorMessage(x) }); }
    setBusy(false);
  };
  return (
    <Modal open={open} onClose={onClose} title={tr('¿Qué datos conservas?')} icon="refresh" width={520}>
      <p className="text-[12.5px] text-muted mb-4">{tr('Hay cambios en este equipo y también en la carpeta de sincronización. Monto no los mezcla: elige qué copia conservar.')}</p>
      <div className="grid gap-3">
        <ChoiceCard selected={false} onClick={() => !busy && void pick('keep-remote')} title={tr('Usar los datos de la carpeta')} description={tr('Recomendado si es un equipo nuevo. Antes se guarda una copia de seguridad de lo que hay aquí.')} />
        <ChoiceCard selected={false} onClick={() => !busy && void pick('keep-local')} title={tr('Usar los datos de este equipo')} description={tr('Reemplaza la copia de la carpeta; los otros equipos recibirán estos datos.')} />
      </div>
    </Modal>
  );
}

/** Settings → Data: turn on sync through a folder the user already syncs (OneDrive, Google Drive…). */
export function SyncCard() {
  const e = useEngine();
  const toast = useApp((s) => s.toast);
  const [state, setState] = useState(getSyncState);
  const [setup, setSetup] = useState<{ folder: string; first: boolean; pw: string; pw2: string; err: string; busy: boolean } | null>(null);
  const [choice, setChoice] = useState(false);
  const [busy, setBusy] = useState(false);
  const refresh = () => setState(getSyncState());

  if (!syncSupported()) return null;

  const start = async () => {
    if (!setup) return;
    if (!setup.folder) return setSetup({ ...setup, err: tr('Elige una carpeta.') });
    if (setup.first && setup.pw !== setup.pw2) return setSetup({ ...setup, err: tr('Las contraseñas no coinciden.') });
    setSetup({ ...setup, busy: true, err: '' });
    try {
      const r = await enableSync(e, setup.folder, setup.pw, setup.first);
      setSetup(null);
      refresh();
      if (r === 'conflict') setChoice(true);
      else toast({ kind: 'success', title: tr('Sincronización activada'), body: DONE[r] });
    } catch (x) { setSetup({ ...setup, busy: false, err: errorMessage(x) }); }
  };
  const now = async () => {
    setBusy(true);
    try { const r = await runSync(e); if (r === 'conflict') setChoice(true); else if (r && DONE[r]) toast({ kind: 'success', title: DONE[r]! }); } catch (x) { toast({ kind: 'error', title: tr('No se pudo sincronizar'), body: errorMessage(x) }); }
    refresh();
    setBusy(false);
  };

  return (
    <Card hover={false} className="p-6">
      <div className="flex items-start gap-4">
        <IconTile name="refresh" color="var(--blue)" size={44} />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold">{tr('Sincronizar entre tus equipos')}</p>
          <p className="text-[12.5px] text-muted mt-1">{tr('Usa una carpeta que ya sincronizas, como OneDrive o Google Drive. Monto guarda ahí tus datos cifrados con una contraseña de sincronización; ni el servicio ni nadie sin ella puede leerlos.')}</p>
          {state ? (
            <>
              <code className="block text-[11.5px] mt-3 bg-surface-2 rounded-[10px] px-3 py-2 break-all">{state.folder}</code>
              <p className="text-[11.5px] text-muted mt-2">{state.lastAt ? tr('Última sincronización: {date}', { date: new Date(state.lastAt).toLocaleString(locale) }) : tr('Aún no se ha sincronizado.')}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button icon="refresh" loading={busy} onClick={() => void now()}>{tr('Sincronizar ahora')}</Button>
                <Button variant="ghost" onClick={() => void disableSync().then(refresh).then(() => toast({ kind: 'success', title: tr('Sincronización desactivada en este equipo') }))}>{tr('Dejar de sincronizar')}</Button>
              </div>
            </>
          ) : (
            <Button className="mt-3" icon="refresh" onClick={() => setSetup({ folder: '', first: true, pw: '', pw2: '', err: '', busy: false })}>{tr('Activar sincronización')}</Button>
          )}
        </div>
      </div>

      <Modal open={!!setup} onClose={() => setSetup(null)} title={tr('Activar sincronización')} icon="refresh" width={520}
        footer={<><Button variant="ghost" onClick={() => setSetup(null)}>{tr('Cancelar')}</Button><Button loading={setup?.busy} onClick={() => void start()}>{tr('Activar')}</Button></>}>
        {setup && (
          <div className="space-y-4">
            <div>
              <p className="text-[12px] font-medium text-ink-2 mb-1.5">{tr('Carpeta')}</p>
              <div className="flex gap-2 items-center">
                <Button variant="secondary" icon="upload" onClick={() => void pickSyncFolder().then((f) => f && setSetup({ ...setup, folder: f, err: '' }))}>{tr('Elegir carpeta')}</Button>
                <span className="text-[11.5px] text-muted break-all">{setup.folder || tr('Por ejemplo, tu carpeta de OneDrive.')}</span>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <ChoiceCard selected={setup.first} onClick={() => setSetup({ ...setup, first: true, err: '' })} title={tr('Es mi primer equipo')} description={tr('Crea la contraseña de sincronización.')} />
              <ChoiceCard selected={!setup.first} onClick={() => setSetup({ ...setup, first: false, err: '' })} title={tr('Ya la activé en otro equipo')} description={tr('Usa la misma contraseña que allí.')} />
            </div>
            <Field label={tr('Contraseña de sincronización')}><Input type="password" value={setup.pw} onChange={(ev) => setSetup({ ...setup, pw: ev.target.value, err: '' })} placeholder={setup.first ? tr('Mínimo 10, con letras y números') : undefined} /></Field>
            {setup.first && <Field label={tr('Confirmar')}><Input type="password" value={setup.pw2} onChange={(ev) => setSetup({ ...setup, pw2: ev.target.value, err: '' })} /></Field>}
            {setup.err && <p className="text-[12px] text-coral">{setup.err}</p>}
            <p className="text-[11.5px] text-muted">{tr('Windows guarda la contraseña en este equipo para sincronizar sin pedírtela. Si la olvidas, desactiva y vuelve a activar con una nueva desde el equipo que tenga los datos más recientes.')}</p>
          </div>
        )}
      </Modal>
      <SyncChoice open={choice} onClose={() => { setChoice(false); refresh(); }} />
    </Card>
  );
}

/** Runs sync in the background: at start-up, and some seconds after each change. */
export function SyncHost() {
  const e = useApp((s) => s.engine);
  const toast = useApp((s) => s.toast);
  const [choice, setChoice] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const running = useRef(false);
  useEffect(() => {
    if (!e || !syncSupported() || !getSyncState()) return;
    const go = async (mode: 'auto' | 'background') => {
      if (running.current) return;
      running.current = true;
      try {
        const r = await runSync(e, mode);
        if (r === 'conflict') setChoice(true);
        else if (r === 'remote-newer') toast({ kind: 'info', title: tr('Hay cambios de otro equipo'), body: tr('Se guardará una copia de lo que tienes antes de traerlos.'), action: { label: tr('Traer cambios'), onClick: () => void go('auto') } });
        else if (r === 'pulled') toast({ kind: 'success', title: tr('Datos traídos de la carpeta') });
      } catch (x) { toast({ kind: 'error', title: tr('No se pudo sincronizar'), body: errorMessage(x) }); }
      running.current = false;
    };
    void go('auto');
    const off = e.subscribe(() => { clearTimeout(timer.current); timer.current = setTimeout(() => void go('background'), 20_000); });
    return () => { off?.(); clearTimeout(timer.current); };
  }, [e]);
  return e ? <SyncChoice open={choice} onClose={() => setChoice(false)} /> : null;
}

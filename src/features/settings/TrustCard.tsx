import { useEffect, useState } from 'react';
import { useApp } from '../../store/app';
import { useEngine, errorMessage } from '../../hooks/useDb';
import { Button, Card, Field, Input, Modal, Toggle } from '../../components/ui';
import { IconTile } from '../../icons';
import { decrypt, isEncrypted } from '../../db/crypto';
import { deviceRecoveryCode } from '../../services/vault';
import { disableHello, enableHello, helloAvailable, helloEnabled } from '../../services/hello';
import { saveFile } from '../../services/files';
import { tr } from '../../lib/i18n';

/** Settings → Security: the recovery code for this computer's key, and unlocking with Windows Hello. */
export function TrustCard({ canSec }: { canSec: boolean }) {
  const e = useEngine();
  const toast = useApp((s) => s.toast);
  const [code, setCode] = useState<string | null>(null);
  const [hello, setHello] = useState<{ available: boolean; on: boolean }>({ available: false, on: false });
  const [askPw, setAskPw] = useState<{ pw: string; err: string; busy: boolean } | null>(null);
  const refresh = async () => setHello({ available: await helloAvailable(), on: await helloEnabled() });
  useEffect(() => { void refresh(); }, [e.encrypted]);

  const showCode = async () => {
    try { setCode(await deviceRecoveryCode()); } catch (x) { toast({ kind: 'error', title: tr('No se pudo leer la llave del equipo'), body: errorMessage(x) }); }
  };
  const turnOn = async () => {
    if (!askPw) return;
    const bytes = await e.adapter.load();
    const right = !!bytes && isEncrypted(bytes) && await decrypt(bytes, askPw.pw).then(() => true, () => false);
    if (!right) return setAskPw({ ...askPw, err: tr('La contraseña no es correcta.') });
    setAskPw({ ...askPw, busy: true, err: '' });
    try {
      if (await enableHello(askPw.pw)) {
        toast({ kind: 'success', title: tr('Windows Hello activado'), body: tr('La próxima vez desbloquea Monto con tu huella, tu rostro o el PIN de Windows.') });
        setAskPw(null);
      } else setAskPw({ ...askPw, busy: false, err: tr('Windows Hello no confirmó tu identidad.') });
    } catch (x) { setAskPw({ ...askPw, busy: false, err: errorMessage(x) }); }
    await refresh();
  };

  if (!e.protectedAtRest && !hello.available) return null;
  return (
    <Card hover={false} className="p-6 space-y-5">
      {e.protectedAtRest && (
        <div className="flex items-start gap-4">
          <IconTile name="key" color="var(--blue)" size={44} />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold">{tr('Clave de recuperación')}</p>
            <p className="text-[12.5px] text-muted mt-1">{tr('Tus copias automáticas usan la llave de este equipo. Guarda esta clave fuera de la computadora: si cambias de equipo o reinstalas Windows, la necesitarás para abrir esas copias.')}</p>
            {canSec && <Button className="mt-3" variant="secondary" icon="key" onClick={() => void showCode()}>{tr('Ver clave de recuperación')}</Button>}
          </div>
        </div>
      )}
      {hello.available && (
        <div className={e.protectedAtRest ? 'border-t border-line/70 pt-5' : ''}>
          <Toggle checked={hello.on} disabled={!e.encrypted || !canSec}
            label={tr('Desbloquear con Windows Hello')}
            description={e.encrypted ? tr('Usa tu huella, tu rostro o el PIN de Windows en lugar de escribir la contraseña. Windows guarda la contraseña y solo la entrega después de confirmar que eres tú.') : tr('Requiere establecer una contraseña.')}
            onChange={(v) => { if (v) setAskPw({ pw: '', err: '', busy: false }); else void disableHello().then(refresh).then(() => toast({ kind: 'success', title: tr('Windows Hello desactivado') })); }} />
        </div>
      )}

      <Modal open={!!code} onClose={() => setCode(null)} title={tr('Clave de recuperación')} icon="key" width={520}
        footer={<>
          <Button variant="ghost" onClick={() => setCode(null)}>{tr('Cerrar')}</Button>
          <Button variant="secondary" icon="copy" onClick={() => void navigator.clipboard.writeText(code ?? '').then(() => toast({ kind: 'success', title: tr('Clave copiada') }))}>{tr('Copiar')}</Button>
          <Button icon="download" onClick={() => void saveFile('monto-clave-de-recuperacion.txt', `${tr('Clave de recuperación de Monto')}\r\n\r\n${code}\r\n\r\n${tr('Abre las copias de seguridad de este equipo en otra computadora: Configuración → Datos y copias → Importar respaldo.')}\r\n`, [{ name: tr('Texto'), extensions: ['txt'] }], 'text/plain')}>{tr('Guardar en un archivo')}</Button>
        </>}>
        <p className="text-[12.5px] text-muted">{tr('Con esta clave cualquiera puede abrir las copias de seguridad de este equipo. Guárdala en un lugar seguro, por ejemplo impresa o en tu gestor de contraseñas, y no en la misma carpeta que las copias.')}</p>
        <code className="block mt-4 rounded-[14px] bg-surface-2 border border-line px-4 py-3 text-[15px] leading-relaxed tracking-[0.06em] font-mono break-words select-all">{code}</code>
      </Modal>

      <Modal open={!!askPw} onClose={() => setAskPw(null)} title={tr('Activar Windows Hello')} icon="lock" width={440}
        footer={<><Button variant="ghost" onClick={() => setAskPw(null)}>{tr('Cancelar')}</Button><Button loading={askPw?.busy} onClick={() => void turnOn()}>{tr('Continuar')}</Button></>}>
        <Field label={tr('Contraseña de la aplicación')} error={askPw?.err || undefined}>
          <Input type="password" autoFocus value={askPw?.pw ?? ''} onChange={(ev) => askPw && setAskPw({ ...askPw, pw: ev.target.value, err: '' })} onKeyDown={(ev) => { if (ev.key === 'Enter') void turnOn(); }} />
        </Field>
        <p className="text-[11.5px] text-muted mt-3">{tr('Después Windows te pedirá tu huella, tu rostro o tu PIN.')}</p>
      </Modal>
    </Card>
  );
}

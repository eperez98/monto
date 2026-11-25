import { useState } from 'react';
import { Button, Field, Input, Modal } from '../../components/ui';
import { useActor, useCan, useEngine } from '../../hooks/useDb';
import { isTauri, MemoryAdapter } from '../../db/adapters';
import { assertCan } from '../../domain/permissions';
import { IS_PREVIEW } from '../../lib/preview';
import { tr } from '../../lib/i18n';

async function clearBrowserFiles() {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open('monto', 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}
export function ResetData() {
  const e = useEngine(),
    actor = useActor(),
    allowed = useCan('security.manage');
  const [open, setOpen] = useState(false),
    [word, setWord] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (!allowed || IS_PREVIEW) return null;
  const reset = async () => {
    if (busy || word !== tr('BORRAR')) return;
    assertCan(actor.role, 'security.manage');
    setBusy(true);
    try {
      await e.flush();
      e.adapter = new MemoryAdapter();
      if (isTauri()) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('reset_local_data');
      } else await clearBrowserFiles();
      for (const storage of [localStorage, sessionStorage]) {
        for (const key of Object.keys(storage)) if (key.startsWith('monto:')) storage.removeItem(key);
      }
      location.reload();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };
  return (
    <div className="mt-5">
      <Button
        variant="danger"
        icon="trash"
        onClick={() => {
          setWord('');
          setError('');
          setOpen(true);
        }}
      >
        {tr('Borrar todos los datos de Monto')}
      </Button>
      {open && (
        <Modal
          open
          title={tr('Empezar de nuevo')}
          onClose={() => {
            if (!busy && !error) setOpen(false);
          }}
          footer={
            <Button variant="danger" disabled={busy || word !== tr('BORRAR')} onClick={() => void reset()}>
              {tr('Borrar todos los datos de Monto')}
            </Button>
          }
        >
          <p className="mb-4">
            {tr(
              'Se eliminarán todos los perfiles de este equipo, sus cuentas, movimientos, cotizaciones y copias locales. Después se abrirá la configuración inicial. Esta acción es irreversible.',
            )}
          </p>
          <Field label={tr('Escribe {word} para confirmar', { word: tr('BORRAR') })} error={error}>
            <Input autoFocus value={word} disabled={busy} onChange={(ev) => setWord(ev.target.value)} />
          </Field>
        </Modal>
      )}
    </div>
  );
}

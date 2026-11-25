import { useRef, useState } from 'react';
import { Button, Field, Input } from '../../components/ui';
import { activeProfileId } from '../../db/adapters';
import { verifySecret } from '../../db/crypto';
import type { Engine } from '../../db/engine';
import { tr } from '../../lib/i18n';
import { guarded } from '../../services/attempts';
import { profilePinHash } from '../../services/profiles';
import { ProfileSwitcher } from './ProfileSwitcher';

export function ProfilePinGate({ engine, onOpen }: { engine: Engine; onOpen: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);
  return <div className="min-h-screen grid place-items-center p-4">
    <form className="card w-full max-w-sm grid gap-4 p-6" onSubmit={async ev => {
      ev.preventDefault();
      if (pending.current || !/^\d{6}$/.test(pin)) return;
      pending.current = true;
      try {
        const valid = await guarded('profile:' + activeProfileId(), () => verifySecret(pin, profilePinHash(engine)));
        if (valid) onOpen();
        else setError(tr('PIN incorrecto'));
      } catch (err) { setError((err as Error).message); }
      finally { pending.current = false; setPin(''); }
    }}>
      <h1 className="text-xl font-semibold">{tr('Desbloquear perfil')}</h1>
      <Field label={tr('PIN de 6 dígitos')} error={error}><Input autoFocus type="password" inputMode="numeric" maxLength={6} value={pin} onChange={ev => setPin(ev.target.value.replace(/\D/g, ''))} /></Field>
      <Button type="submit" disabled={pin.length !== 6}>{tr('Desbloquear')}</Button>
      <ProfileSwitcher />
    </form>
  </div>;
}

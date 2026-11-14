import { useState } from 'react';
import { motion } from 'motion/react';
import { LogoMark } from '../../brand/Logo';
import { Button, Input } from '../../components/ui';
import { Icon } from '../../icons';
import { tr } from '../../lib/i18n';
import { ProfileSwitcher } from './ProfileSwitcher';
import { AppSkeleton } from './AppSkeleton';

export function LockScreen({ onUnlock, title = tr('Monto está bloqueado'), subtitle = tr('Introduce tu contraseña para descifrar tus datos.') }: { onUnlock: (password: string) => Promise<string | null>; title?: string; subtitle?: string }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [show, setShow] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw) return;
    setBusy(true);
    const r = await onUnlock(pw);
    setBusy(false);
    if (r) { setErr(r); setShake((s) => s + 1); setPw(''); }
  };
  return (
    <motion.div key="lock" className="fixed inset-0 z-50 overflow-hidden bg-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <AppSkeleton />
      <div className="absolute inset-0 grid place-items-center p-4">
      <motion.form onSubmit={submit} key={shake} animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : undefined} transition={{ duration: 0.4 }}
        className="acrylic card w-full max-w-[360px] rounded-[26px] bg-surface/85 backdrop-blur-xl border border-line/70 shadow-pop p-8 text-center">
        <span className="mb-5 inline-flex items-center gap-2.5"><LogoMark size={28} className="text-ink" /><span className="text-[20px] font-bold tracking-[-0.05em] text-ink">monto</span></span>
        <h1 className="text-[18px] font-semibold tracking-[-0.03em] text-ink">{title}</h1>
        <p className="text-[12.5px] text-muted mt-1 mb-6">{subtitle}</p>
        <div className="relative">
          <Input type={show ? 'text' : 'password'} autoFocus placeholder={tr('Contraseña')} value={pw} onChange={(e) => { setPw(e.target.value); setErr(null); }} invalid={!!err} className="h-12 text-center pr-10" aria-label={tr('Contraseña')} />
          <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink" aria-label={tr('Mostrar contraseña')}><Icon name={show ? 'eyeOff' : 'eye'} size={18} /></button>
        </div>
        {err && <p className="text-[12px] text-coral mt-2">{err}</p>}
        <Button type="submit" size="lg" className="w-full mt-5" loading={busy} icon="lock">{tr('Desbloquear')}</Button>
        <p className="text-[11px] text-muted mt-5 leading-relaxed">{tr('Tus datos están cifrados con AES-256 en este equipo. Si olvidas la contraseña no podrán recuperarse.')}</p>
        <ProfileSwitcher className="mt-4" />
      </motion.form>
      </div>
    </motion.div>
  );
}

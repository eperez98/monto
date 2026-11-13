import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useApp } from '../../store/app';
import { Button } from '../ui';
import { tr } from '../../lib/i18n';

export const PREVIEW_MSG = 'monto-preview';
export const PREVIEW_READY = 'monto-preview-ready';

const W = 393;
const H = 852;
const BEZEL = 12;

/**
 * Shows Monto inside an iPhone-style frame (iOS 27 look, simulated). The frame holds the app in an iframe at
 * phone width so the real mobile layout kicks in; it runs on an in-memory copy of the data that is never saved.
 */
export function PhonePreview() {
  const open = useApp((s) => s.phonePreview);
  const setOpen = useApp((s) => s.setPhonePreview);
  const ref = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(1);
  const [time, setTime] = useState(() => new Date());

  const send = useCallback(() => {
    const { engine, actor } = useApp.getState();
    const w = ref.current?.contentWindow;
    if (!w || !engine || !actor) return;
    w.postMessage({ type: PREVIEW_MSG, bytes: engine.plainBytes(), actorId: actor.id, route: 'dashboard' }, location.origin);
  }, []);

  useEffect(() => {
    if (!open) return;
    const fit = () => setScale(Math.min(1, (window.innerHeight - 40) / (H + BEZEL * 2)));
    const onMsg = (ev: MessageEvent) => { if (ev.origin === location.origin && ev.source === ref.current?.contentWindow && ev.data?.type === PREVIEW_READY) send(); };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setOpen(false); };
    const tick = setInterval(() => setTime(new Date()), 30_000);
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('message', onMsg);
    window.addEventListener('keydown', onKey);
    return () => { clearInterval(tick); window.removeEventListener('resize', fit); window.removeEventListener('message', onMsg); window.removeEventListener('keydown', onKey); };
  }, [open, send, setOpen]);

  if (!open) return null;
  const clock = `${time.getHours() % 12 || 12}:${String(time.getMinutes()).padStart(2, '0')}`;
  return (
    <motion.div className="fixed inset-0 z-[96] flex items-center justify-center gap-10 bg-[#0b0a12]/85 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="dialog" aria-modal="true" aria-label={tr('Vista de celular')}>
      <div style={{ width: (W + BEZEL * 2) * scale, height: (H + BEZEL * 2) * scale }}>
        <div className="origin-top-left rounded-[66px] bg-[#1c1c1f] shadow-[0_40px_120px_-20px_rgb(0_0_0/0.8)] ring-2 ring-[#4a4a50]" style={{ width: W + BEZEL * 2, height: H + BEZEL * 2, padding: BEZEL, transform: `scale(${scale})` }}>
          <div className="relative overflow-hidden rounded-[54px] bg-bg" style={{ width: W, height: H }}>
            <div className="absolute inset-x-0 top-0 z-10 flex h-[54px] items-center justify-between px-8 pt-1 text-[16px] font-semibold text-ink" aria-hidden>
              <span className="w-[70px] text-center num">{clock}</span>
              <span className="flex items-center gap-1.5">
                <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
                <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor"><path d="M8 2.2c2.4 0 4.6.9 6.2 2.5l1.3-1.4A10.6 10.6 0 0 0 8 .2 10.6 10.6 0 0 0 .5 3.3l1.3 1.4A8.7 8.7 0 0 1 8 2.2Zm0 3.8c1.4 0 2.6.5 3.6 1.4l1.3-1.4A7 7 0 0 0 8 4a7 7 0 0 0-4.9 2l1.3 1.4C5.4 6.5 6.6 6 8 6Zm0 3.6-1.9 2 1.9 2 1.9-2-1.9-2Z" /></svg>
                <svg width="27" height="13" viewBox="0 0 27 13" fill="none"><rect x="0.5" y="0.5" width="23" height="12" rx="3.8" stroke="currentColor" opacity="0.4" /><rect x="2" y="2" width="18" height="9" rx="2.5" fill="currentColor" /><path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill="currentColor" opacity="0.5" /></svg>
              </span>
            </div>
            <div className="absolute left-1/2 top-[11px] z-20 h-[37px] w-[125px] -translate-x-1/2 rounded-full bg-black" aria-hidden />
            <iframe ref={ref} title={tr('Monto en vista de celular')} src={`${location.pathname}?preview=phone`} className="absolute inset-x-0 bottom-0 block border-0" style={{ top: 54, width: W, height: H - 54 }} />
            <div className="pointer-events-none absolute bottom-2 left-1/2 z-20 h-[5px] w-[136px] -translate-x-1/2 rounded-full bg-ink/80" aria-hidden />
          </div>
        </div>
      </div>
      <div className="max-w-[260px] text-white">
        <p className="text-[18px] font-semibold tracking-[-0.02em]">{tr('Vista de celular')}</p>
        <p className="text-[12.5px] text-white/70 mt-1">{tr('iPhone · iOS 27 (simulado) · {w} × {h} pt', { w: W, h: H })}</p>
        <p className="text-[12.5px] text-white/70 mt-3">{tr('Usa una copia temporal de tus datos: lo que cambies aquí no se guarda.')}</p>
        <div className="flex flex-col gap-2 mt-5">
          <Button variant="secondary" icon="refresh" onClick={() => ref.current?.contentWindow?.location.reload()}>{tr('Recargar con mis datos')}</Button>
          <Button icon="close" onClick={() => setOpen(false)}>{tr('Salir de la vista de celular')}</Button>
        </div>
      </div>
    </motion.div>
  );
}

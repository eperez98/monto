import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useApp } from '../../store/app';
import { Button } from '../ui';
import { Icon } from '../../icons';
import { tr } from '../../lib/i18n';

export const TOUR_DONE_KEY = 'monto:tour-done';

interface Step { target?: string; title: string; body: string }

const STEPS: Step[] = [
  { title: tr('Bienvenido a Monto'), body: tr('Te muestro lo esencial en menos de un minuto. Puedes repetir esta guía cuando quieras desde «Guía de inicio».') },
  { target: 'hero', title: tr('Tu saldo disponible'), body: tr('La suma de tus cuentas en PAB y USD. Abajo ves el balance del periodo y cuánto estás ahorrando.') },
  { target: 'quick', title: tr('Acciones rápidas'), body: tr('Registra un gasto, un ingreso o una transferencia con un clic.') },
  { target: 'new-tx', title: tr('Registrar desde cualquier sección'), body: tr('Este botón está siempre arriba. Atajo de teclado: Ctrl+N.') },
  { target: 'period', title: tr('Elige el periodo'), body: tr('Cambia entre día, semana, mes, trimestre o año. Los totales y gráficos se ajustan solos.') },
  { target: 'scope', title: tr('Personal u hogar'), body: tr('Alterna entre tus finanzas y las de toda la familia.') },
  { target: 'nav', title: tr('Las secciones'), body: tr('Están agrupadas por tarea: el día a día, planificar y el hogar. Pasa el cursor sobre una para ver para qué sirve.') },
  { target: 'nav-plan', title: tr('Empieza por el plan mensual'), body: tr('Anota tus gastos fijos uno por uno y Monto te dice cuánto te queda y cuánto puedes ahorrar.') },
  { target: 'prefs', title: tr('Idioma y tema'), body: tr('Cambia entre español e inglés y entre modo claro y oscuro.') },
  { target: 'guide', title: tr('¿Quieres repasar?'), body: tr('Abre esta guía cuando quieras. ¡Listo, ya puedes empezar!') },
];

const PAD = 8;
const CARD_W = 340;

function markDone() { try { localStorage.setItem(TOUR_DONE_KEY, '1'); } catch { /* private mode: the tour just shows again */ } }

export function GuideTour() {
  const open = useApp((s) => s.tourOpen);
  const setOpen = useApp((s) => s.setTourOpen);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  // Steps whose element isn't on screen (e.g. "Personal / Hogar" in individual mode) are skipped.
  // Hidden targets (e.g. the sidebar on a phone-width screen) are skipped too.
  const steps = open ? STEPS.filter((s) => !s.target || !!document.querySelector(`[data-tour="${s.target}"]`)?.getClientRects().length) : [];
  const step = steps[Math.min(i, steps.length - 1)];

  // First run: open once the dashboard has rendered.
  useEffect(() => {
    let done = '1';
    try { done = localStorage.getItem(TOUR_DONE_KEY) ?? ''; } catch { /* treat as done */ }
    if (done) return;
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, [setOpen]);

  useEffect(() => { if (open) setI(0); }, [open]);

  const measure = useCallback(() => {
    const el = step?.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null;
    if (!el) return setRect(null);
    el.scrollIntoView({ block: 'nearest' });
    setRect(el.getBoundingClientRect());
  }, [step?.target]);

  useLayoutEffect(() => { if (open) measure(); }, [open, measure]);
  useEffect(() => {
    if (!open) return;
    nextRef.current?.focus();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, measure, i]);

  const close = useCallback(() => { markDone(); setOpen(false); }, [setOpen]);
  const next = useCallback(() => (i >= steps.length - 1 ? close() : setI(i + 1)), [i, steps.length, close]);
  const back = useCallback(() => setI(Math.max(0, i - 1)), [i]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, close, next, back]);

  if (!step) return null;

  const vw = window.innerWidth, vh = window.innerHeight;
  let pos: { top: number; left: number };
  if (!rect) pos = { top: vh / 2 - 110, left: vw / 2 - CARD_W / 2 };
  else if (rect.right < 300 && vw > 700) pos = { top: Math.min(Math.max(16, rect.top), vh - 260), left: rect.right + PAD + 16 };
  else if (vh - rect.bottom > 250) pos = { top: rect.bottom + PAD + 12, left: Math.min(Math.max(16, rect.left + rect.width / 2 - CARD_W / 2), vw - CARD_W - 16) };
  else pos = { top: Math.max(16, rect.top - PAD - 240), left: Math.min(Math.max(16, rect.left + rect.width / 2 - CARD_W / 2), vw - CARD_W - 16) };

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="tour" className="fixed inset-0 z-[90]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-labelledby="tour-title">
          {rect
            ? <div className="tour-hole absolute pointer-events-none ring-2 ring-lavender" style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }} />
            : <div className="absolute inset-0 bg-[rgb(12_10_24/0.62)]" />}
          <motion.div className="absolute rounded-[24px] bg-surface border border-line shadow-pop p-5" style={{ width: CARD_W }} initial={false} animate={pos} transition={{ type: 'spring', stiffness: 380, damping: 36 }}>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-brand-soft text-brand text-[11px] font-semibold"><Icon name="sparkle" size={12} />{tr('Paso {n} de {total}', { n: i + 1, total: steps.length })}</span>
              <button onClick={close} className="text-[12px] text-muted hover:text-ink">{tr('Saltar guía')}</button>
            </div>
            <h3 id="tour-title" className="text-[17px] font-semibold tracking-[-0.02em] text-ink mt-3">{step.title}</h3>
            <p className="text-[13px] text-ink-2 mt-1.5 leading-relaxed">{step.body}</p>
            <div className="flex items-center gap-1 mt-4" aria-hidden>
              {steps.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-5 bg-brand' : 'w-1.5 bg-surface-3'}`} />)}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              {i > 0 && <Button variant="ghost" size="sm" onClick={back}>{tr('Anterior')}</Button>}
              <Button ref={nextRef} size="sm" onClick={next}>{i >= steps.length - 1 ? tr('Empezar') : tr('Siguiente')}</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

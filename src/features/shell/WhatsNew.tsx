import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { useApp } from '../../store/app';
import { getPrefs, setPrefs } from '../../db/repo/core';
import { useQuery } from '../../hooks/useDb';
import { Button, IconButton, useMotionOK, ease } from '../../components/ui';
import { ThemePicker, ModePicker } from '../../components/ThemePicker';
import { Icon } from '../../icons';
import { IS_PREVIEW } from '../../lib/preview';
import { tr } from '../../lib/i18n';

/** Bump when a release brings changes worth a tour; users who already saw this one don't see it again. */
export const WHATS_NEW_ID = '1.0.1';
const KEY = 'monto:whats-new';
export const markWhatsNewSeen = () => { try { localStorage.setItem(KEY, WHATS_NEW_ID); } catch { /* private mode: it may show again, harmless */ } };
const seen = () => { try { return localStorage.getItem(KEY) === WHATS_NEW_ID; } catch { return true; } };

// Screenshots of each change (fictional data), captured by scripts/e2e.mjs with WHATSNEW_SHOTS=1.
const IMAGES = import.meta.glob('../../assets/whatsnew/*.jpg', { eager: true, import: 'default' }) as Record<string, string>;
const img = (name: string) => IMAGES[`../../assets/whatsnew/${name}.jpg`];

interface Slide { key: string; icon: string; title: () => string; body: () => string; image: string; theme?: boolean }
const SLIDES: Slide[] = [
  { key: 'design', icon: 'sparkle', image: 'glass', theme: true, title: () => tr('Un diseño nuevo: Cristal'), body: () => tr('Paneles translúcidos sobre color suave, más luz y menos ruido. Si prefieres algo con más textura, prueba «Relieve»: papel, cuero y botones con volumen. Elígelo aquí mismo.') },
  { key: 'security', icon: 'shield', image: 'security', title: () => tr('Tus datos, cifrados siempre'), body: () => tr('Aunque no uses contraseña, tus datos y copias se guardan cifrados con una llave de este equipo que vive en Windows. Otra app que mire la carpeta solo ve datos ilegibles. Los PIN usan un hash lento y, tras varios intentos fallidos, Monto hace esperar.') },
  { key: 'country', icon: 'home', image: 'country', title: () => tr('Colombia y bancos de EE. UU.'), body: () => tr('Elige el país de tus cuentas: Panamá o Colombia, con pesos y sus bancos. En Panamá también puedes añadir bancos en línea de EE. UU. como Chime, SoFi o Ally, en dólares.') },
  { key: 'menu', icon: 'menu', image: 'menu', title: () => tr('Un menú que se aparta'), body: () => tr('El menú ahora es una barra de íconos que te deja más espacio. Pasa el cursor y se despliega encima del contenido; fíjalo abierto si lo prefieres. Los grupos se pliegan para ver solo lo que usas.') },
  { key: 'receipt', icon: 'upload', image: 'receipt', title: () => tr('Registra con la foto del comprobante'), body: () => tr('Sube, arrastra o pega la foto o el PDF de un recibo. Monto lee el comercio, la fecha y el total, y tú revisas antes de guardar. La foto no sale de tu computadora.') },
  { key: 'summary', icon: 'dashboard', image: 'summary', title: () => tr('Un resumen a tu medida'), body: () => tr('Elige qué tarjetas ves y en qué orden. Al empezar cada mes, «Tu mes en resumen» te cuenta cuánto ahorraste y en qué se fue tu dinero.') },
  { key: 'banks', icon: 'bank', image: 'banks', title: () => tr('Tu banco, sin teclear'), body: () => tr('Conecta el correo donde te llegan los avisos de tu banco: Monto reconoce a 16 bancos de Panamá, evita duplicados y tú eliges qué agregar. También lee mejor los estados de cuenta en CSV.') },
  { key: 'done', icon: 'check', image: 'done', title: () => tr('Todo listo'), body: () => tr('Además: modo compacto, Mica de Windows 11, copia de seguridad antes de cada actualización y la vista de celular revisada. Puedes cambiar el tema cuando quieras en Configuración → Apariencia.') },
];

/** Shown once to people who already used Monto, the first time they open this version. */
export function WhatsNewHost() {
  const [open, setOpen] = useState(() => !IS_PREVIEW && !seen());
  if (!open) return null;
  return <WhatsNew onClose={() => { markWhatsNewSeen(); setOpen(false); }} />;
}

export function WhatsNew({ onClose }: { onClose: () => void }) {
  const ok = useMotionOK();
  const engine = useApp((s) => s.engine);
  const prefs = useQuery((e) => getPrefs(e));
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  const go = (n: number) => setI(Math.max(0, Math.min(SLIDES.length - 1, n)));
  const picture = (s: Slide) => img(s.theme && prefs.palette === 'skeuo' ? 'skeuo' : s.image);

  return (
    <motion.div className="fixed inset-0 z-[60] grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onKeyDown={(e) => { if (e.key === 'ArrowRight') go(i + 1); if (e.key === 'ArrowLeft') go(i - 1); }}>
      <div className="absolute inset-0 bg-[#0b0820]/55 backdrop-blur-md" />
      <motion.section role="dialog" aria-modal="true" aria-label={tr('Novedades de Monto')} tabIndex={-1}
        initial={ok ? { opacity: 0, y: 24, scale: 0.97 } : false} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.45, ease }}
        className="card acrylic relative w-full max-w-[920px] max-h-[calc(100vh-32px)] flex flex-col rounded-[30px] bg-surface border border-line shadow-pop overflow-hidden">
        <header className="flex items-center justify-between px-7 pt-6">
          <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-brand-soft text-brand text-[11.5px] font-semibold"><Icon name="sparkle" size={13} />{tr('Novedades de esta versión')}</span>
          <span className="text-[12px] text-muted">{tr('{n} de {total}', { n: i + 1, total: SLIDES.length })}</span>
        </header>

        <div className="relative overflow-hidden flex-1 min-h-0">
          <motion.div className="flex h-full" animate={{ x: `-${i * 100}%` }} transition={ok ? { type: 'spring', stiffness: 260, damping: 32 } : { duration: 0 }}>
            {SLIDES.map((s, k) => (
              <article key={s.key} aria-hidden={k !== i} className="w-full shrink-0 overflow-y-auto px-7 py-5 grid md:grid-cols-[1.25fr_1fr] gap-6 items-start" {...(k !== i ? { inert: '' } : {})}>
                <figure className="rounded-[20px] overflow-hidden border border-line bg-surface-2 aspect-[16/10] grid place-items-center">
                  {picture(s) ? <img src={picture(s)} alt={s.title()} className="w-full h-full object-cover object-left-top" loading={k === 0 ? 'eager' : 'lazy'} /> : <Icon name={s.icon} size={56} className="text-brand" />}
                </figure>
                <div className="min-w-0">
                  <span className="grid place-items-center size-11 rounded-[14px] bg-brand-soft text-brand mb-4"><Icon name={s.icon} size={20} /></span>
                  <h2 className="text-[24px] font-semibold tracking-[-0.03em] leading-tight">{s.title()}</h2>
                  <p className="text-[13.5px] text-ink-2 mt-2 leading-relaxed">{s.body()}</p>
                  {s.theme && engine && (
                    <div className="mt-5 space-y-3">
                      <ThemePicker oneColumn value={prefs.palette} onChange={(v) => setPrefs(engine, { palette: v })} only={['glass', 'skeuo', ...(prefs.palette && !['glass', 'skeuo'].includes(prefs.palette) ? [prefs.palette] : [])]} />
                      <ModePicker value={prefs.theme} onChange={(v) => setPrefs(engine, { theme: v })} />
                    </div>
                  )}
                </div>
              </article>
            ))}
          </motion.div>
        </div>

        <footer className="flex items-center justify-between gap-3 px-7 py-5 border-t border-line/60">
          <div className="w-28">{i > 0 && <Button variant="ghost" icon="chevronLeft" onClick={() => go(i - 1)}>{tr('Anterior')}</Button>}</div>
          <div className="flex items-center gap-1.5" role="tablist" aria-label={tr('Diapositivas')}>
            {SLIDES.map((s, k) => (
              <button key={s.key} role="tab" aria-selected={k === i} aria-label={s.title()} onClick={() => go(k)}
                className={clsx('h-2 rounded-full transition-all', k === i ? 'w-6 bg-brand' : 'w-2 bg-line hover:bg-muted')} />
            ))}
          </div>
          <div className="w-28 flex justify-end">
            <AnimatePresence mode="wait" initial={false}>
              {last
                ? <motion.span key="use" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Button onClick={onClose}>{tr('Usar Monto')}</Button></motion.span>
                : <motion.span key="next" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Button onClick={() => go(i + 1)}>{tr('Siguiente')}<Icon name="chevronRight" size={16} /></Button></motion.span>}
            </AnimatePresence>
          </div>
        </footer>
        <IconButton icon="close" size={34} label={tr('Cerrar novedades')} className="!absolute top-5 right-24" onClick={onClose} />
      </motion.section>
    </motion.div>
  );
}

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { useApp, type RouteKey } from '../../store/app';
import { useCan, useProfile } from '../../hooks/useDb';
import { Icon } from '../../icons';
import { NAV_GROUPS } from './nav';
import { QuickPrefs } from './QuickPrefs';
import { tr } from '../../lib/i18n';

const TABS: Array<[RouteKey, string, string]> = [['dashboard', 'dashboard', tr('Resumen')], ['transactions', 'transactions', tr('Movimientos')], ['plan', 'savings', tr('Plan')]];

/** Bottom tab bar for phone-width screens (below `md`), with a "More" sheet holding every section. */
export function MobileNav({ onSwitchMember }: { onSwitchMember: () => void }) {
  const route = useApp((s) => s.route);
  const go = useApp((s) => s.go);
  const openTx = useApp((s) => s.openTx);
  const profile = useProfile();
  const canCreate = useCan('tx.create');
  const [more, setMore] = useState(false);
  const pick = (r: RouteKey) => { go(r); setMore(false); };
  const tab = (r: RouteKey, icon: string, label: string) => (
    <button key={r} onClick={() => pick(r)} aria-current={route === r ? 'page' : undefined} className={clsx('flex-1 flex flex-col items-center gap-0.5 py-1.5 text-[10.5px]', route === r ? 'text-brand font-semibold' : 'text-muted')}>
      <Icon name={icon} size={21} active={route === r} />{label}
      <span className={clsx('size-1 rounded-full', route === r ? 'bg-brand' : 'bg-transparent')} />
    </button>
  );
  return (
    <>
      <nav aria-label={tr('Principal')} className="md:hidden fixed inset-x-3 bottom-[calc(10px+var(--safe-bottom,0px))] z-40 flex items-center rounded-[26px] bg-surface/90 backdrop-blur-xl border border-line/70 shadow-pop px-2">
        {TABS.slice(0, 2).map(([r, i, l]) => tab(r, i, l))}
        {canCreate && (
          <button onClick={() => openTx()} aria-label={tr('Nuevo movimiento')} className="grid place-items-center size-12 -mt-6 mx-1 rounded-full bg-brand text-brand-ink shadow-pop active:scale-95 transition">
            <Icon name="plus" size={22} strokeWidth={2.2} />
          </button>
        )}
        {TABS.slice(2).map(([r, i, l]) => tab(r, i, l))}
        <button onClick={() => setMore(true)} className={clsx('flex-1 flex flex-col items-center gap-0.5 py-1.5 text-[10.5px]', more ? 'text-brand font-semibold' : 'text-muted')}>
          <Icon name="menu" size={21} />{tr('Más')}<span className="size-1" />
        </button>
      </nav>
      <AnimatePresence>
        {more && (
          <motion.div className="md:hidden fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setMore(false)} />
            <motion.div role="dialog" aria-modal="true" aria-label={tr('Más secciones')} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="absolute inset-x-0 bottom-0 max-h-[85%] overflow-y-auto rounded-t-[28px] bg-surface border-t border-line px-4 pt-3 pb-[calc(20px+var(--safe-bottom,0px))]">
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-surface-3" />
              <div className="flex items-center justify-between mb-2"><QuickPrefs /><button onClick={() => { setMore(false); onSwitchMember(); }} className="text-[12.5px] text-brand">{tr('Cambiar de integrante')}</button></div>
              {NAV_GROUPS.map((g) => (
                <div key={g.title} className="mt-3">
                  <p className="px-1 mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">{g.title}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {g.items.filter((n) => !n.family || profile.mode !== 'individual').map((n) => (
                      <button key={n.key} onClick={() => pick(n.key)} className={clsx('flex flex-col items-center gap-1.5 rounded-[18px] p-3 text-[11.5px] text-center border', route === n.key ? 'border-brand bg-brand-soft/60 text-brand' : 'border-line/70 text-ink-2')}>
                        <Icon name={n.icon} size={20} />{n.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={() => pick('settings')} className="mt-4 w-full flex items-center gap-3 rounded-[18px] border border-line/70 p-3 text-[13px] text-ink"><Icon name="settings" size={18} />{tr('Configuración')}</button>
              <button onClick={() => pick('about')} className="mt-2 w-full flex items-center gap-3 rounded-[18px] border border-line/70 p-3 text-[13px] text-ink"><Icon name="info" size={18} />{tr('Acerca de Monto')}</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

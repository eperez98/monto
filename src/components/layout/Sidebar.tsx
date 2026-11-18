import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { Icon } from '../../icons';
import { LogoMark, Wordmark } from '../../brand/Logo';
import { useApp } from '../../store/app';
import { NAV_GROUPS } from './nav';
import { useActor, useProfile, useQuery, accountsVisibleTo } from '../../hooks/useDb';
import { listMembers } from '../../db/repo/core';
import { balances, upcoming } from '../../db/repo/analytics';
import { Avatar, Money } from '../ui';
import { formatDate } from '../../lib/dates';
import { ROLE_LABEL } from '../../domain/permissions';
import { tr } from '../../lib/i18n';

const RAIL = 76;
const OPEN = 260;
const PIN_KEY = 'monto:nav-pinned';
const GROUPS_KEY = 'monto:nav-closed-groups';
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode: the menu still works, it just won't remember */ } };

/**
 * Expandable navigation: a compact rail of icons that opens as a floating glass panel while the pointer (or keyboard focus)
 * is on it, and can be pinned open. Groups fold away, and the extras (accounts, next payment) only appear when open.
 */
export function Sidebar({ onSwitchMember }: { onSwitchMember: () => void }) {
  const route = useApp((s) => s.route);
  const go = useApp((s) => s.go);
  const actor = useActor();
  const profile = useProfile();
  const members = useQuery((e) => listMembers(e));
  const me = members.find((m) => m.id === actor.id);
  const { accounts } = useQuery((e) => balances(e, accountsVisibleTo(profile.mode, actor.id)), [actor.id, profile.mode]);
  const next = useQuery((e) => upcoming(e, { scope: 'personal', memberId: actor.id }, 45).find((u) => u.kind !== 'income'), [actor.id]);

  const [pinned, setPinned] = useState(() => read(PIN_KEY) === '1');
  const [peek, setPeek] = useState(false);
  const [closed, setClosed] = useState<string[]>(() => { try { return JSON.parse(read(GROUPS_KEY) ?? '[]'); } catch { return []; } });
  const timer = useRef<number>();
  const open = pinned || peek;
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const enter = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setPeek(true), 180); };
  const leave = () => { window.clearTimeout(timer.current); setPeek(false); };
  const pin = () => { const v = !pinned; setPinned(v); setPeek(false); write(PIN_KEY, v ? '1' : '0'); };
  const toggleGroup = (t: string) => { const v = closed.includes(t) ? closed.filter((x) => x !== t) : [...closed, t]; setClosed(v); write(GROUPS_KEY, JSON.stringify(v)); };
  // Choosing something closes the floating menu, and cancels a pending hover-open so it doesn't pop back over the page.
  const pick = (k: Parameters<typeof go>[0]) => { window.clearTimeout(timer.current); go(k); if (!pinned) setPeek(false); };

  const startTour = () => { pick('dashboard'); useApp.getState().setTourOpen(true); };

  const label = (text: string) => (
    <AnimatePresence initial={false}>
      {open && <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.16 }} className="relative z-10 truncate">{text}</motion.span>}
    </AnimatePresence>
  );

  return (
    <motion.aside className="relative h-full shrink-0" animate={{ width: pinned ? OPEN : RAIL }} initial={false} transition={{ type: 'spring', stiffness: 420, damping: 40 }}>
      <motion.div
        // Only keyboard focus opens it: a mouse click must not move the button between press and release.
        onMouseEnter={pinned ? undefined : enter} onMouseLeave={pinned ? undefined : leave}
        onFocus={pinned ? undefined : (e) => { if ((e.target as HTMLElement).matches(':focus-visible')) setPeek(true); }} onBlur={pinned ? undefined : (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setPeek(false); }}
        onKeyDown={(e) => { if (e.key === 'Escape' && !pinned) setPeek(false); }}
        animate={{ width: open ? OPEN : RAIL }} initial={false} transition={{ type: 'spring', stiffness: 420, damping: 40 }}
        className={clsx('acrylic glass absolute inset-y-0 left-0 z-40 flex flex-col bg-surface border-r border-line/70 overflow-hidden', peek && !pinned && 'shadow-pop rounded-r-[24px]')}
      >
        <div className={clsx('flex items-center h-[72px] shrink-0', open ? 'px-5 justify-between' : 'justify-center')}>
          {open ? <Wordmark /> : <LogoMark size={30} />}
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3 space-y-2" aria-label={tr('Principal')} data-tour="nav">
          {NAV_GROUPS.map((g, gi) => {
            const folded = open && closed.includes(g.title);
            const items = g.items.filter((n) => !n.family || profile.mode !== 'individual');
            return (
              <div key={g.title}>
                {open ? (
                  <button onClick={() => toggleGroup(g.title)} aria-expanded={!folded} className="w-full flex items-center justify-between px-3 h-7 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted hover:text-ink-2">
                    {g.title}<Icon name="chevronDown" size={13} className={clsx('transition-transform', folded && '-rotate-90')} />
                  </button>
                ) : gi > 0 && <div className="mx-4 my-2 h-px bg-line" />}
                <div className="space-y-0.5">
                  {items.filter((n) => !folded || n.key === route).map((n) => {
                    const active = route === n.key;
                    return (
                      <button key={n.key} data-tour={`nav-${n.key}`} onClick={() => pick(n.key)} aria-label={n.label} title={open ? n.hint : n.label} aria-current={active ? 'page' : undefined}
                        className={clsx('nav-pill group relative w-full flex items-center gap-3 h-10 rounded-full text-[13px] transition-colors', open ? 'px-3' : 'justify-center', active ? 'text-brand-ink font-semibold' : 'text-ink-2 hover:text-ink hover:bg-surface-3/70')}>
                        {active && <motion.span layoutId="nav-active" className="nav-pill absolute inset-0 rounded-full bg-brand shadow-[0_8px_20px_-10px_color-mix(in_srgb,var(--brand)_75%,transparent)]" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                        <Icon name={n.icon} size={19} active={active} className={clsx('relative z-10 shrink-0 transition-colors', active ? 'text-brand-ink' : 'text-muted group-hover:text-ink-2')} />
                        {label(n.label)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {open && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }} className="pt-2">
              <div className="px-3 mb-1 flex items-center justify-between">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">{tr('Cuentas')}</p>
                <button onClick={() => pick('accounts')} className="text-muted hover:text-ink" aria-label={tr('Gestionar cuentas')}><Icon name="plus" size={14} /></button>
              </div>
              {accounts.slice(0, 4).map((a) => (
                <button key={a.id} onClick={() => pick('accounts')} className="w-full flex items-center gap-2.5 px-3 h-8 rounded-[10px] text-[12.5px] text-ink-2 hover:bg-surface-3/70">
                  <span className="size-1.5 rounded-full shrink-0" style={{ background: a.color }} />
                  <span className="truncate flex-1 text-left">{a.name}</span>
                  <Money cents={a.balance} currency={a.currency} compact className={clsx('text-[11.5px]', a.balance < 0 ? 'text-coral' : 'text-muted')} />
                </button>
              ))}
              {!accounts.length && <p className="px-3 text-[12px] text-muted">{tr('Sin cuentas todavía')}</p>}
              {next && (
                <button onClick={() => pick('calendar')} className="mt-3 w-full text-left rounded-[18px] bg-surface-2 border border-line/70 px-3.5 py-3 hover:shadow-card transition">
                  <p className="text-[10.5px] text-muted">{tr('Próximo pago')}</p>
                  <p className="text-[12.5px] font-semibold text-ink truncate mt-0.5">{next.title}</p>
                  <p className="text-[11.5px] text-ink-2 mt-0.5">{formatDate(next.date, 'day')} · <Money cents={next.amount} currency={next.currency} /></p>
                </button>
              )}
            </motion.div>
          )}
        </nav>

        <div className={clsx('shrink-0 p-3 border-t border-line/60 space-y-1', !open && 'flex flex-col items-center')}>
          <button onClick={startTour} data-tour="guide" aria-label={tr('Guía de inicio')} title={tr('Aprende a usar Monto en 1 minuto')}
            className={clsx('flex items-center gap-3 rounded-[16px] text-[13px] font-medium text-brand hover:bg-brand-soft transition', open ? 'w-full px-3 py-2' : 'size-10 justify-center')}>
            <Icon name="sparkle" size={18} className="shrink-0" />{label(tr('Guía de inicio'))}
          </button>
          <button onClick={() => pick('about')} aria-label={tr('Acerca de Monto')} title={tr('Acerca de Monto')}
            className={clsx('group flex items-center gap-3 rounded-[16px] text-[13px] hover:bg-surface-3 transition', open ? 'w-full px-3 py-2' : 'size-10 justify-center', route === 'about' ? 'text-ink bg-surface-3' : 'text-muted')}>
            <Icon name="info" size={18} active={route === 'about'} className="shrink-0" />{label(tr('Acerca de Monto'))}
          </button>
          <button onClick={() => pick('settings')} aria-label={tr('Configuración')} title={tr('Configuración')}
            className={clsx('group flex items-center gap-3 rounded-[16px] text-[13px] hover:bg-surface-3 transition', open ? 'w-full px-3 py-2' : 'size-10 justify-center', route === 'settings' ? 'text-ink bg-surface-3' : 'text-muted')}>
            <Icon name="settings" size={18} active={route === 'settings'} className="shrink-0" />{label(tr('Configuración'))}
          </button>
          <button onClick={onSwitchMember} title={tr('Cambiar de integrante')} aria-label={tr('Cambiar de integrante')}
            className={clsx('flex items-center gap-2.5 rounded-[16px] hover:bg-surface-3/70 transition', open ? 'w-full px-2 py-2' : 'size-11 justify-center')}>
            {me && <Avatar name={me.name} color={me.color} emoji={me.emoji} size={30} />}
            {open && (
              <span className="min-w-0 text-left">
                <span className="block text-[12.5px] font-semibold text-ink truncate">{me?.name}</span>
                <span className="block text-[11px] text-muted truncate">{me ? ROLE_LABEL[me.role] : ''}</span>
              </span>
            )}
          </button>
          <button onClick={pin} aria-pressed={pinned} aria-label={pinned ? tr('Contraer el menú') : tr('Fijar el menú abierto')} title={pinned ? tr('Contraer el menú') : tr('Fijar el menú abierto')}
            className={clsx('flex items-center gap-3 rounded-[16px] text-[13px] text-muted hover:text-ink hover:bg-surface-3 transition', open ? 'w-full px-3 py-2' : 'size-10 justify-center')}>
            <Icon name="chevronLeft" size={17} className={clsx('shrink-0 transition-transform', !pinned && 'rotate-180')} />{label(pinned ? tr('Contraer el menú') : tr('Fijar el menú abierto'))}
          </button>
        </div>
      </motion.div>
    </motion.aside>
  );
}

import { useEffect } from 'react';
import { motion } from 'motion/react';
import { LogoMark } from '../../brand/Logo';
import { useMotionOK } from '../../components/ui';
import { playBootChime } from '../../lib/bootSound';
import { IS_PREVIEW } from '../../lib/preview';
import { tr } from '../../lib/i18n';

const BLOBS = [
  { c: 'rgb(139 108 255 / 0.55)', x: '18%', y: '22%', s: 420, d: 0 },
  { c: 'rgb(94 200 242 / 0.45)', x: '82%', y: '18%', s: 380, d: 0.4 },
  { c: 'rgb(244 166 215 / 0.45)', x: '72%', y: '86%', s: 460, d: 0.8 },
  { c: 'rgb(255 211 110 / 0.35)', x: '22%', y: '82%', s: 340, d: 1.2 },
];

/** Start screen: colour that drifts in, the mark assembling itself, the name letter by letter, and a soft chime. */
export function Splash({ status }: { status: string }) {
  const ok = useMotionOK();
  useEffect(() => { if (!IS_PREVIEW) playBootChime(); }, []);
  return (
    <motion.div key="splash" className="fixed inset-0 z-50 overflow-hidden bg-bg" exit={ok ? { opacity: 0, scale: 1.04 } : { opacity: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
      {BLOBS.map((b) => (
        <motion.span key={b.c} aria-hidden className="absolute rounded-full blur-3xl" style={{ left: b.x, top: b.y, width: b.s, height: b.s, marginLeft: -b.s / 2, marginTop: -b.s / 2, background: b.c }}
          initial={ok ? { opacity: 0, scale: 0.6 } : false} animate={ok ? { opacity: 1, scale: [1, 1.12, 1], x: [0, 24, 0], y: [0, -18, 0] } : { opacity: 1 }}
          transition={ok ? { opacity: { duration: 0.8, delay: b.d * 0.3 }, scale: { duration: 7, repeat: Infinity, ease: 'easeInOut', delay: b.d }, x: { duration: 9, repeat: Infinity, ease: 'easeInOut', delay: b.d }, y: { duration: 8, repeat: Infinity, ease: 'easeInOut', delay: b.d } } : { duration: 0 }} />
      ))}
      <div className="absolute inset-0 grid place-items-center">
        <div className="flex flex-col items-center">
          <motion.div className="rounded-[34px] shadow-[0_30px_80px_-20px_rgb(76_47_214_/_0.65)]" initial={ok ? { y: 10 } : false} animate={{ y: 0 }} transition={{ duration: 0.6 }}>
            <LogoMark size={104} animated={ok} />
          </motion.div>
          <h1 className="mt-6 flex text-[40px] font-bold tracking-[-0.05em] text-ink" aria-label="monto">
            {'monto'.split('').map((ch, i) => (
              <motion.span key={i} aria-hidden initial={ok ? { opacity: 0, y: 14, filter: 'blur(6px)' } : false} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.45, delay: ok ? 0.55 + i * 0.06 : 0, ease: [0.22, 1, 0.36, 1] }}>{ch}</motion.span>
            ))}
          </h1>
          <motion.p className="serif text-[17px] text-ink-2 -mt-1" initial={ok ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: ok ? 0.95 : 0 }}>{tr('tus finanzas, en orden')}</motion.p>
          <motion.div className="mt-8 h-[3px] w-40 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label={status} initial={ok ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ delay: ok ? 1 : 0 }}>
            <motion.div className="h-full w-1/3 rounded-full bg-gradient-to-r from-brand to-[#F2A516]" animate={ok ? { x: ['-100%', '300%'] } : undefined} transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }} />
          </motion.div>
          <p className="mt-3 h-4 text-[11.5px] text-muted">{status}</p>
        </div>
      </div>
    </motion.div>
  );
}

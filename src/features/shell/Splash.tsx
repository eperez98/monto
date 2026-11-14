import { motion } from 'motion/react';
import { LogoMark } from '../../brand/Logo';
import { useMotionOK } from '../../components/ui';
import { AppSkeleton } from './AppSkeleton';

/** Minimal start screen: the app's skeleton in the background and a small mark with progress on top. */
export function Splash({ status }: { status: string }) {
  const ok = useMotionOK();
  return (
    <motion.div key="splash" className="fixed inset-0 z-50 overflow-hidden bg-bg" exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
      <AppSkeleton />
      <div className="absolute inset-0 grid place-items-center">
        <motion.div className="acrylic card flex flex-col items-center rounded-[26px] border border-line/70 bg-surface/80 px-10 py-8 shadow-pop backdrop-blur-xl"
          initial={ok ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <span className="flex items-center gap-2.5">
            <LogoMark size={30} className="text-ink" />
            <span className="text-[22px] font-bold tracking-[-0.05em] text-ink">monto</span>
          </span>
          <div className="mt-6 h-[3px] w-36 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label={status}>
            <motion.div className="h-full w-1/3 rounded-full bg-brand" animate={ok ? { x: ['-100%', '300%'] } : undefined} transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }} />
          </div>
          <p className="mt-3 h-4 text-[11.5px] text-muted">{status}</p>
        </motion.div>
      </div>
    </motion.div>
  );
}

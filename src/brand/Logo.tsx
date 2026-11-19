import { useId } from 'react';
import { motion } from 'motion/react';
import clsx from 'clsx';

/**
 * Monto mark (1.0.1): a violet rounded badge with a white "M" drawn as a chart line and a gold coin rising past its
 * right peak. Same drawing as assets/brand/app-icon.svg, which the Windows icons are generated from.
 */
export function LogoMark({ size = 32, className, animated = false }: { size?: number; className?: string; animated?: boolean }) {
  const id = useId().replace(/:/g, '');
  const spring = { type: 'spring', stiffness: 260, damping: 18 } as const;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" className={clsx('shrink-0', className)} role="img" aria-label="Monto">
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8B6CFF" /><stop offset=".55" stopColor="#5B3FE0" /><stop offset="1" stopColor="#2E1D86" /></linearGradient>
        <linearGradient id={`${id}shine`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".38" /><stop offset=".55" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <linearGradient id={`${id}gold`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#F2A516" /><stop offset="1" stopColor="#FFE08A" /></linearGradient>
      </defs>
      <motion.g style={{ transformOrigin: '60px 60px' }} initial={animated ? { scale: 0.55, opacity: 0, rotate: -8 } : false} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={animated ? spring : { duration: 0 }}>
        <rect x="4" y="4" width="112" height="112" rx="34" fill={`url(#${id}bg)`} />
        <rect x="4" y="4" width="112" height="112" rx="34" fill={`url(#${id}shine)`} />
      </motion.g>
      <motion.path d="M32 86V46l28 30 28-30v40" stroke="#fff" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round"
        initial={animated ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={animated ? { duration: 0.75, delay: 0.25, ease: [0.22, 1, 0.36, 1] } : { duration: 0 }} />
      <motion.circle cx="88" cy="29" r="10" fill={`url(#${id}gold)`}
        initial={animated ? { y: -26, opacity: 0, scale: 0.4 } : false} animate={{ y: 0, opacity: 1, scale: 1 }} transition={animated ? { ...spring, delay: 0.85 } : { duration: 0 }} />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-2', className)}>
      <LogoMark size={26} />
      <span className="text-[19px] font-bold tracking-[-0.05em] text-ink">monto</span>
    </span>
  );
}

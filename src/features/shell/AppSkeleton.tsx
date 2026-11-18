/** Placeholder of the app's layout (sidebar, top bar, cards) shown while Monto loads or is locked. */
export function AppSkeleton() {
  const bar = (w: string, h = 'h-3') => <div className={`skeleton rounded-full ${h} ${w}`} />;
  return (
    <div className="absolute inset-0 flex opacity-70" aria-hidden>
      <div className="hidden md:flex w-[76px] shrink-0 flex-col items-center gap-4 border-r border-line/60 bg-surface/60 py-5">
        <div className="skeleton size-8 rounded-[10px]" />
        <div className="mt-4 space-y-4">{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <div key={i} className="skeleton size-6 rounded-md" />)}</div>
      </div>
      <div className="flex-1 p-6 md:p-8 space-y-5">
        <div className="flex items-center justify-between">{bar('w-48', 'h-6')}<div className="flex gap-3">{bar('w-40', 'h-9')}{bar('w-28', 'h-9')}</div></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <div key={i} className="skeleton card h-32 rounded-[26px]" />)}</div>
        <div className="flex gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-11 w-28 rounded-full" />)}</div>
        <div className="grid grid-cols-12 gap-5"><div className="skeleton card col-span-12 xl:col-span-8 h-72 rounded-[26px]" /><div className="skeleton card col-span-12 xl:col-span-4 h-72 rounded-[26px]" /></div>
      </div>
    </div>
  );
}

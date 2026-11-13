import { useEffect, useState } from 'react';
import { activeProfileId, listProfiles, type ProfileEntry } from '../../db/adapters';
import { switchProfile } from '../../services/profiles';
import { Icon } from '../../icons';
import { tr } from '../../lib/i18n';

export const profileLabel = (p: ProfileEntry, i: number) => p.name || (i === 0 ? tr('Perfil principal') : tr('Perfil {n}', { n: i + 1 }));

/** Lets someone on the lock or member screen open a different profile. Hidden with a single profile. */
export function ProfileSwitcher({ className }: { className?: string }) {
  const [list, setList] = useState<ProfileEntry[]>([]);
  useEffect(() => { void listProfiles().then(setList).catch(() => undefined); }, []);
  if (list.length < 2) return null;
  return (
    <label className={`inline-flex items-center gap-2 text-[12.5px] text-ink-2 ${className ?? ''}`}>
      <Icon name="user" size={15} />{tr('Perfil')}
      <select className="h-8 rounded-full bg-surface-2 border border-line px-3 text-[12.5px] text-ink" value={activeProfileId()} onChange={(e) => void switchProfile(e.target.value)}>
        {list.map((p, i) => <option key={p.id} value={p.id}>{profileLabel(p, i)}</option>)}
      </select>
    </label>
  );
}

import { useApp } from '../store/app';
import { pickProfilePhoto } from '../services/photo';
import { Avatar, Button } from './ui';
import { tr } from '../lib/i18n';

/** Profile photo with "Elegir foto" / "Quitar foto"; the parent decides when to save it. */
export function PhotoField({ name, color, emoji, photo, onChange }: { name: string; color: string; emoji?: string | null; photo: string | null; onChange: (p: string | null) => void }) {
  const choose = async () => {
    try { const p = await pickProfilePhoto(); if (p) onChange(p); } catch (err) { useApp.getState().toast({ kind: 'error', title: (err as Error).message }); }
  };
  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} color={color} emoji={emoji} photo={photo} size={64} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" icon="upload" onClick={() => void choose()}>{photo ? tr('Cambiar foto') : tr('Elegir foto de perfil')}</Button>
        {photo && <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>{tr('Quitar foto')}</Button>}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { useApp } from '../../store/app';
import { useActor, useCan, useEngine, useMutate, useProfile, useQuery, errorMessage } from '../../hooks/useDb';
import { getPrefs, setPrefs, setProfile, listSessions, setMemberPin, setMemberPhoto, getMember } from '../../db/repo/core';
import { PhotoField } from '../../components/PhotoField';
import { listCategories, createCategory, updateCategory, deleteCategory } from '../../db/repo/finance';
import { createBackup, deleteOldBackups, exportBackupFile, exportJSON, oldBackups, pickBackupFile, restoreFromBytes } from '../../services/backup';
import { decrypt, isDeviceEncrypted, isEncrypted } from '../../db/crypto';
import { Engine } from '../../db/engine';
import { Button, Card, CardHeader, ChoiceCard, Field, Input, Modal, PageHeader, Segmented, Select, Toggle, Badge, Confirm, useConfirm } from '../../components/ui';
import { Icon, IconTile, ICON_NAMES } from '../../icons';
import { LogoMark } from '../../brand/Logo';
import type { ProfileMode } from '../../db/types';
import { APP_VERSION_LABEL, IS_PRERELEASE, versionLabel } from '../../lib/version';
import { ThemePicker, ModePicker } from '../../components/ThemePicker';
import { bootSoundOn, playBootChime, setBootSound } from '../../lib/bootSound';
import { countryOf } from '../../domain/countries';
import { passwordProblem } from '../../domain/auth';
import { checkForUpdate, downloadAndInstall, updatesSupported, type UpdateInfo } from '../../services/updates';
import { lang, locale, setLang, tr } from '../../lib/i18n';
import { activeProfileId, listProfiles, type ProfileEntry } from '../../db/adapters';
import { editCurrentProfile, profilePinHash, copyProfileForCouple, createProfile, deleteCurrentProfile, switchProfile } from '../../services/profiles';
import { PartnerWizard, PARTNER_SETUP_KEY } from '../family/PartnerWizard';
import { profileLabel } from '../shell/ProfileSwitcher';
import { StylePicker } from '../dashboard/StylePicker';
import { ResetData } from './ResetData';
import { MailTester } from './MailTester';
import { RulesCard } from './RulesCard';
import { TrustCard } from './TrustCard';
import { disableHello, helloEnabled } from '../../services/hello';
import { IS_PREVIEW } from '../../lib/preview';

type Tab = 'profile' | 'appearance' | 'security' | 'data' | 'mail' | 'categories' | 'updates' | 'about';
const TABS: Array<{ k: Tab; label: string; icon: string }> = [
  { k: 'profile', label: tr('Perfil'), icon: 'user' }, { k: 'appearance', label: tr('Apariencia'), icon: 'sun' }, { k: 'security', label: tr('Seguridad'), icon: 'lock' },
  { k: 'data', label: tr('Datos y copias'), icon: 'database' }, { k: 'mail', label: tr('Correo del banco'), icon: 'bell' }, { k: 'categories', label: tr('Categorías'), icon: 'budget' }, { k: 'updates', label: tr('Actualizaciones'), icon: 'refresh' }, { k: 'about', label: tr('Acerca de'), icon: 'info' },
];

export default function Settings() {
  const [tab, setTab] = useState<Tab>(() => {
    try { const t = sessionStorage.getItem('monto:settings-tab') as Tab | null; sessionStorage.removeItem('monto:settings-tab'); return t ?? 'profile'; } catch { return 'profile'; }
  });
  return (
    <div>
      <PageHeader title={tr('Configuración')} subtitle={tr('Personaliza Monto y protege tu información')} />
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        <nav className="flex md:block gap-1 md:space-y-1 overflow-x-auto -mx-1 px-1 md:mx-0 md:px-0">
          {TABS.map((t) => <button key={t.k} onClick={() => setTab(t.k)} className={clsx('group shrink-0 md:w-full flex items-center gap-3 h-10 px-3 rounded-[12px] whitespace-nowrap text-[13px] transition', tab === t.k ? 'bg-surface shadow-card text-ink font-semibold' : 'text-ink-2 hover:bg-surface-3/60')}><Icon name={t.icon} size={17} active={tab === t.k} />{t.label}</button>)}
        </nav>
        <div className="space-y-5 max-w-[760px]">
          {tab === 'profile' && <ProfileTab />}
          {tab === 'appearance' && <AppearanceTab />}
          {tab === 'security' && <SecurityTab />}
          {tab === 'data' && <DataTab />}
          {tab === 'categories' && <><CategoriesTab /><RulesCard /></>}
          {tab === 'mail' && <MailTester />}
          {tab === 'updates' && <UpdatesTab />}
          {tab === 'about' && <AboutTab />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab() {
  const profile = useProfile();
  const actorId = useActor().id;
  const me = useQuery((e) => getMember(e, actorId), [actorId]);
  const canManage = useCan('member.manage');
  const mutate = useMutate();
  const [name, setName] = useState(profile.name);
  const [household, setHousehold] = useState(profile.householdName ?? '');
  const engine = useEngine();
  const toast = useApp((s) => s.toast);
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyName, setCopyName] = useState('');
  return (
    <>
    {me && (
      <Card hover={false} className="p-6">
        <p className="text-[13.5px] font-semibold mb-1">{tr('Tu foto de perfil')}</p>
        <p className="text-[12px] text-muted mb-4">{tr('Se ve en el menú, al elegir integrante y en el hogar. Se guarda cifrada junto a tus datos.')}</p>
        <PhotoField name={me.name} color={me.color} emoji={me.emoji} photo={me.photo} onChange={(p) => mutate((e, a) => setMemberPhoto(e, a, a.id, p), p ? tr('Foto actualizada') : tr('Foto quitada'))} />
      </Card>
    )}
    <Card hover={false} className="p-6 space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label={tr('Nombre del perfil')}><Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} /></Field>
        <Field label={tr('Nombre del hogar')}><Input value={household} onChange={(e) => setHousehold(e.target.value)} disabled={!canManage} placeholder={tr('Ej. Familia Rodríguez')} /></Field>
      </div>
      <div>
        <p className="text-[12px] font-medium text-ink-2 mb-2">{tr('Tipo de perfil')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([['individual', 'user', tr('Individual')], ['couple', 'handshake', tr('En pareja')], ['family', 'family', tr('Familia')]] as Array<[ProfileMode, string, string]>).map(([m, i, l]) => <ChoiceCard key={m} selected={profile.mode === m} onClick={() => canManage && mutate((e) => setProfile(e, { mode: m }), tr('Tipo de perfil actualizado'))} icon={i} title={l} />)}
        </div>
      </div>
      {canManage && profile.mode === 'individual' && (
        <div className="rounded-[18px] border border-brand/30 bg-brand-soft/40 p-4">
          <p className="text-[13.5px] font-semibold">{tr('¿Llevas las finanzas en pareja?')}</p>
          <p className="text-[12.5px] text-ink-2 mt-0.5">{tr('Monto te pedirá los datos de tu pareja como en la configuración inicial: nombre, ingresos, gastos y cuenta.')}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button size="sm" icon="family" onClick={() => setPartnerOpen(true)}>{tr('Convertir en perfil de pareja')}</Button>
            <Button size="sm" variant="secondary" icon="copy" onClick={() => { setCopyName(tr('Pareja')); setCopyOpen(true); }}>{tr('Crear perfil de pareja externo')}</Button>
          </div>
        </div>
      )}
      <PartnerWizard key={String(partnerOpen)} open={partnerOpen} onClose={() => setPartnerOpen(false)} />
      <Modal open={copyOpen} onClose={() => setCopyOpen(false)} title={tr('Crear perfil de pareja externo')} icon="copy" width={460}
        footer={<><Button variant="ghost" onClick={() => setCopyOpen(false)}>{tr('Cancelar')}</Button><Button disabled={!copyName.trim()} onClick={() => void copyProfileForCouple(engine, copyName, PARTNER_SETUP_KEY).catch((err: Error) => toast({ kind: 'error', title: tr('No se pudo completar'), body: err.message }))}>{tr('Copiar y continuar')}</Button></>}>
        <p className="text-[13px] text-ink-2 mb-4">{tr('Se copia tu perfil actual (cuentas, movimientos y ajustes) en un perfil nuevo, y ahí se añaden los datos de tu pareja. Tu perfil actual no cambia.')}</p>
        <Field label={tr('Nombre del nuevo perfil')}><Input autoFocus value={copyName} maxLength={60} onChange={(e) => setCopyName(e.target.value)} /></Field>
      </Modal>
      <div>
        <p className="text-[12px] font-medium text-ink-2 mb-2">{tr('Moneda principal')}</p>
        <Segmented value={profile.primaryCurrency} onChange={(v) => canManage && mutate((e) => setProfile(e, { primaryCurrency: v }), tr('Moneda principal actualizada'))} options={countryOf(profile.country).currencies.map((c) => ({ value: c, label: c === 'PAB' ? 'B/. Balboa (PAB)' : c === 'USD' ? tr('$ Dólar (USD)') : tr('$ Peso colombiano (COP)') }))} />
        <p className="text-[11.5px] text-muted mt-2">{tr('País de las cuentas: {country}.', { country: countryOf(profile.country).name() })}{' '}{profile.country === 'CO' ? tr('Todas las cuentas van en pesos (COP).') : tr('Paridad fija PAB:USD 1:1. Las cuentas conservan su propia moneda.')}</p>
      </div>
      {canManage && <div className="flex justify-end"><Button onClick={() => { mutate((e) => setProfile(e, { name: name.trim() || profile.name, householdName: household.trim() || undefined }), tr('Perfil guardado')); }}>{tr('Guardar')}</Button></div>}
    </Card>
    <ProfilesCard currentName={profile.name} />
    </>
  );
}

function ProfilesCard({ currentName }: { currentName: string }) {
  const engine = useEngine();
  const actor = useActor();
  const canDelete = useCan('security.manage');
  const toast = useApp((s) => s.toast);
  const [list, setList] = useState<ProfileEntry[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const current = activeProfileId();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState('');
  const [pin, setPin] = useState('');
  const [repeat, setRepeat] = useState('');
  const [removePin, setRemovePin] = useState(false);
  const [saving, setSaving] = useState(false);
  const openEditor = (name: string) => {
    setLabel(name); setPin(''); setRepeat(''); setRemovePin(false); setEditing(true);
  };
  useEffect(() => {
    if (list.length && sessionStorage.getItem('monto:edit-profile') === current) {
      sessionStorage.removeItem('monto:edit-profile');
      if (canDelete) openEditor(list.find(p => p.id === current)?.name || currentName);
    }
  }, [list, current, canDelete, currentName]);
  useEffect(() => { void listProfiles().then(setList).catch(() => undefined); }, []);
  const fail = (err: unknown) => toast({ kind: 'error', title: tr('No se pudo completar'), body: (err as Error).message });
  return (
    <Card hover={false} className="p-6 mt-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13.5px] font-semibold">{tr('Perfiles')}</p>
          <p className="text-[12px] text-muted mt-0.5">{tr('Cada perfil guarda sus propios datos por separado, por ejemplo uno personal y otro para un negocio.')}</p>
        </div>
        <Button size="sm" icon="plus" onClick={() => { setNewName(''); setCreating(true); }}>{tr('Nuevo perfil')}</Button>
      </div>
      <ul className="mt-4 space-y-1.5">
        {list.map((p, i) => (
          <li key={p.id} className="flex items-center gap-3 rounded-[16px] border border-line/70 px-4 py-2.5">
            <Icon name="user" size={16} className="text-muted" />
            <span className="flex-1 text-[13px] font-medium truncate">{p.id === current ? (p.name || currentName) : profileLabel(p, i)}</span>
            {p.id === current ? <Badge tone="green">{tr('Abierto')}</Badge> : <Button size="sm" variant="secondary" onClick={() => void switchProfile(p.id).catch(fail)}>{tr('Abrir')}</Button>}
            {canDelete && <Button size="sm" variant="ghost" icon="edit" onClick={() => {
              if (p.id === current) openEditor(p.name || currentName);
              else {
                sessionStorage.setItem('monto:edit-profile', p.id);
                sessionStorage.setItem('monto:settings-tab', 'profile');
                void switchProfile(p.id).catch(fail);
              }
            }}>{tr('Editar')}</Button>}
          </li>
        ))}
      </ul>
      {editing && canDelete && <Modal open title={tr('Editar perfil')} onClose={() => setEditing(false)} width={440}
        footer={<><Button variant="ghost" onClick={() => setEditing(false)}>{tr('Cancelar')}</Button>
          <Button disabled={saving || !label.trim() || (!removePin && (pin !== repeat || (!!pin && !/^\d{6}$/.test(pin))))} onClick={async () => {
            setSaving(true);
            try {
              setList(await editCurrentProfile(engine, actor, label, removePin ? '' : pin || null));
              setEditing(false);
            } catch (err) { fail(err); } finally { setSaving(false); }
          }}>{tr('Guardar')}</Button></>}>
        <div className="grid gap-4">
          <Field label={tr('Nombre del perfil')}><Input autoFocus maxLength={60} value={label} onChange={ev => setLabel(ev.target.value)} /></Field>
          {profilePinHash(engine) && <Toggle label={tr('Quitar PIN del perfil')} checked={removePin} onChange={setRemovePin} />}
          {!removePin && <>
            <Field label={tr('Nuevo PIN de 6 dígitos')} hint={tr('Déjalo vacío para conservar el bloqueo actual.')}><Input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={ev => setPin(ev.target.value.replace(/\D/g, ''))} /></Field>
            {pin && <Field label={tr('Confirmar PIN')}><Input type="password" inputMode="numeric" maxLength={6} value={repeat} onChange={ev => setRepeat(ev.target.value.replace(/\D/g, ''))} /></Field>}
          </>}
          <Button variant="danger" icon="trash" onClick={() => { setEditing(false); setConfirmDelete(true); }}>{tr('Borrar este perfil')}</Button>
        </div>
      </Modal>}
      <Modal open={creating} onClose={() => setCreating(false)} title={tr('Nuevo perfil')} icon="user" width={420}
        footer={<><Button variant="ghost" onClick={() => setCreating(false)}>{tr('Cancelar')}</Button><Button disabled={!newName.trim()} onClick={() => void createProfile(newName).catch(fail)}>{tr('Crear y abrir')}</Button></>}>
        <Field label={tr('Nombre del perfil')} hint={tr('Monto se reiniciará en el nuevo perfil para configurarlo.')}><Input autoFocus value={newName} maxLength={60} onChange={(e) => setNewName(e.target.value)} placeholder={tr('Ej. Negocio')} /></Field>
      </Modal>
      <Confirm open={confirmDelete} onClose={() => setConfirmDelete(false)} confirmLabel={tr('Borrar perfil')}
        title={tr('¿Borrar el perfil «{name}»?', { name: list.find(p => p.id === current)?.name || currentName })}
        body={tr('Se eliminarán todos sus movimientos, cuentas, integrantes y ajustes. Se guarda una copia de seguridad en la carpeta de copias por si te equivocas. Después se abrirá otro perfil o la configuración inicial.')}
        onConfirm={() => { setConfirmDelete(false); void deleteCurrentProfile(engine, actor).catch(fail); }} />
    </Card>
  );
}

function AppearanceTab() {
  const engine = useEngine();
  const prefs = useQuery((e) => getPrefs(e));
  const mutate = useMutate();
  const [bootSound, setBootSoundState] = useState(bootSoundOn);
  return (
    <Card hover={false} className="p-6 space-y-6">
      <div>
        <p className="text-[13.5px] font-semibold mb-1">{tr('Modo claro u oscuro')}</p>
        <p className="text-[12px] text-muted mb-3">{tr('“Sistema” sigue automáticamente el modo claro u oscuro de Windows.')}</p>
        <ModePicker value={prefs.theme} onChange={(v) => mutate((e) => setPrefs(e, { theme: v }))} />
      </div>
      <div>
        <p className="text-[13.5px] font-semibold mb-1">{tr('Tema de color')}</p>
        <p className="text-[12px] text-muted mb-3">{tr('Elige el estilo de color. Funciona tanto en modo claro como oscuro.')}</p>
        <ThemePicker value={prefs.palette} onChange={(v) => mutate((e) => setPrefs(e, { palette: v }))} />
      </div>
      <div>
        <p className="text-[13.5px] font-semibold mb-1">{tr('Inicio')}</p>
        <Toggle checked={bootSound} onChange={(v) => { setBootSound(v); setBootSoundState(v); if (v) playBootChime(); }} label={tr('Sonido al iniciar')}
          description={tr('Un toque corto y suave mientras Monto se abre.')} />
      </div>
      <div>
        <p className="text-[13.5px] font-semibold mb-1">{tr('Tamaño')}</p>
        <Toggle checked={prefs.density === 'compact'} onChange={(v) => mutate((e) => setPrefs(e, { density: v ? 'compact' : 'comfortable' }))} label={tr('Modo compacto')}
          description={tr('Todo un poco más pequeño para que quepa más en pantallas de laptop o ventanas reducidas.')} />
      </div>
      <div>
        <p className="text-[13.5px] font-semibold mb-1">{tr('Estilo del resumen')}</p>
        <p className="text-[12px] text-muted mb-3">{tr('Elige cuánta información ves al abrir Monto.')}</p>
        <StylePicker value={prefs.dashboardStyle ?? 'calm'} onChange={(v) => mutate((e) => setPrefs(e, { dashboardStyle: v }))} />
      </div>
      <div>
        <p className="text-[13.5px] font-semibold mb-1">{tr('Avisos de pagos')}</p>
        <Toggle checked={prefs.billAlerts !== false} onChange={(v) => mutate((e) => setPrefs(e, { billAlerts: v }))} label={tr('Avisarme con una notificación de Windows')}
          description={tr('Al abrir Monto, una vez al día, te avisa de los gastos de tu plan mensual que vencen hoy o en los próximos 2 días y aún no marcaste como pagados.')} />
      </div>
      {!IS_PREVIEW && (
        <div>
          <p className="text-[13.5px] font-semibold mb-1">{tr('Vista de celular')}</p>
          <p className="text-[12px] text-muted mb-3">{tr('Mira cómo se ve Monto en un iPhone (iOS 27, simulado). Usa una copia temporal de tus datos.')}</p>
          <Button variant="secondary" icon="phone" onClick={() => useApp.getState().setPhonePreview(true)}>{tr('Abrir vista de celular')}</Button>
        </div>
      )}
      <div>
        <p className="text-[13.5px] font-semibold mb-1">{tr('Animaciones')}</p>
        <p className="text-[12px] text-muted mb-3">{tr('Reduce el movimiento si prefieres una interfaz más estática.')}</p>
        <Segmented value={prefs.reducedMotion} onChange={(v) => mutate((e) => setPrefs(e, { reducedMotion: v }))} options={[{ value: 'system', label: tr('Según Windows') }, { value: 'off', label: tr('Completas') }, { value: 'on', label: tr('Reducidas') }]} />
      </div>
      <div>
        <p className="text-[13.5px] font-semibold mb-1">{tr('Idioma')}</p>
        <p className="text-[12px] text-muted mb-3">{tr('Monto se reiniciará para aplicar el idioma.')}</p>
        <Segmented value={lang} onChange={(v) => { if (v !== lang) void engine.flush().then(() => setLang(v)); }} options={[{ value: 'es', label: 'Español' }, { value: 'en', label: 'English' }]} />
      </div>
    </Card>
  );
}

function SecurityTab() {
  const e = useEngine();
  const actor = useActor();
  const canSec = useCan('security.manage');
  const mutate = useMutate();
  const toast = useApp((s) => s.toast);
  const prefs = useQuery((en) => getPrefs(en));
  const sessions = useQuery((en) => listSessions(en, 12));
  const [open, setOpen] = useState<'set' | 'remove' | null>(null);
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const verifyCurrent = async () => {
    const bytes = await e.adapter.load();
    if (!bytes || !isEncrypted(bytes)) return true;
    try { await decrypt(bytes, cur); return true; } catch { return false; }
  };
  const submit = async () => {
    setErr('');
    if (e.encrypted && !(await verifyCurrent())) return setErr(tr('La contraseña actual no es correcta.'));
    if (open === 'set') {
      const weak = passwordProblem(pw);
      if (weak) return setErr(weak);
      if (pw !== pw2) return setErr(tr('Las contraseñas no coinciden.'));
    }
    setBusy(true);
    try {
      await e.setPassword(open === 'set' ? pw : null);
      // Windows Hello keeps the password itself: after a change it would hold the old one.
      const hadHello = await helloEnabled();
      if (hadHello) await disableHello();
      if (open === 'set' && !prefs.autoLockMinutes) setPrefs(e, { autoLockMinutes: 5 });
      toast({ kind: 'success', title: open === 'set' ? tr('Contraseña establecida') : tr('Contraseña eliminada'), body: hadHello ? tr('Windows Hello se desactivó: vuelve a activarlo con la contraseña nueva.') : open === 'set' ? tr('Tus datos se guardan cifrados con AES-256.') : (e.protectedAtRest ? tr('Tus datos siguen cifrados con la llave de este equipo.') : tr('Tus datos ya no están cifrados.')) });
      setOpen(null); setCur(''); setPw(''); setPw2('');
    } catch (x) { setErr(errorMessage(x)); }
    setBusy(false);
  };

  return (
    <>
      <Card hover={false} className="p-6 space-y-5">
        <div className="flex items-start gap-4">
          <IconTile name="lock" color={e.protectedAtRest ? 'var(--emerald)' : 'var(--amber)'} size={44} />
          <div className="flex-1">
            <p className="text-[14px] font-semibold flex items-center gap-2">{tr('Contraseña de la aplicación')}{' '}{e.encrypted ? <Badge tone="green">{tr('Cifrado con contraseña')}</Badge> : e.protectedAtRest ? <Badge tone="green">{tr('Cifrado con la llave del equipo')}</Badge> : <Badge tone="amber">{tr('Sin cifrar')}</Badge>}</p>
            <p className="text-[12.5px] text-muted mt-1">{e.encrypted
              ? tr('Tus datos se guardan cifrados con AES-256-GCM y una clave derivada de tu contraseña (PBKDF2, 600 000 iteraciones). Sin ella nadie puede leerlos, ni copiando el archivo.')
              : e.protectedAtRest
                ? tr('Tus datos y copias ya se guardan cifrados con una llave de este equipo, guardada en el Administrador de credenciales de Windows. Añade una contraseña para que además nadie pueda abrir Monto en esta cuenta de Windows sin ella.')
                : tr('Cifra la base de datos local con AES-256-GCM (clave derivada con PBKDF2). Sin la contraseña nadie puede leer tus datos, ni siquiera copiando el archivo.')}</p>
          </div>
        </div>
        {canSec ? <div className="flex gap-2"><Button icon="lock" onClick={() => setOpen('set')}>{e.encrypted ? tr('Cambiar contraseña') : tr('Establecer contraseña')}</Button>{e.encrypted && <Button variant="ghost" onClick={() => setOpen('remove')}>{tr('Quitar contraseña')}</Button>}</div> : <p className="text-[12px] text-muted">{tr('Solo un administrador puede cambiar la seguridad.')}</p>}
        <div className="border-t border-line/70 pt-5">
          <Field label={tr('Bloqueo automático por inactividad')} hint={e.encrypted ? tr('Al bloquearse, los datos se cifran y se cierran en memoria. Atajo: Ctrl + L.') : tr('Requiere establecer una contraseña.')}>
            <Select value={prefs.autoLockMinutes} disabled={!e.encrypted || !canSec} onChange={(ev) => mutate((en) => setPrefs(en, { autoLockMinutes: Number(ev.target.value) }), tr('Bloqueo automático actualizado'))}>
              {[0, 1, 2, 5, 10, 15, 30, 60].map((m) => <option key={m} value={m}>{m === 0 ? tr('Nunca') : `${m} minuto${m > 1 ? 's' : ''}`}</option>)}
            </Select>
          </Field>
        </div>
        <div className="border-t border-line/70 pt-5">
          <p className="text-[13.5px] font-semibold">{tr('Tu PIN de integrante')}</p>
          <p className="text-[12px] text-muted mb-3">{tr('Se pide al cambiar de integrante en este equipo.')}</p>
          <div className="flex gap-2"><Input type="password" inputMode="numeric" maxLength={6} placeholder={tr('4 a 6 dígitos')} value={pin} onChange={(ev) => setPin(ev.target.value.replace(/\D/g, ''))} className="w-48" />
            <Button variant="secondary" onClick={async () => { try { await setMemberPin(e, actor, actor.id, pin || null); toast({ kind: 'success', title: pin ? 'PIN guardado' : 'PIN eliminado' }); setPin(''); } catch (x) { toast({ kind: 'error', title: tr('PIN no válido'), body: errorMessage(x) }); } }}>{pin ? tr('Guardar PIN') : tr('Quitar PIN')}</Button></div>
        </div>
      </Card>
      <TrustCard canSec={canSec} />
      <Card hover={false}>
        <CardHeader title={tr('Sesiones recientes')} subtitle={tr('Inicios de sesión en este equipo')} />
        <table className="w-full text-[12.5px] m-3 mt-2" style={{ width: 'calc(100% - 24px)' }}>
          <thead className="text-muted text-left"><tr><th className="font-medium py-1">{tr('Integrante')}</th><th className="font-medium">{tr('Inicio')}</th><th className="font-medium">{tr('Fin')}</th><th className="font-medium">{tr('Motivo')}</th></tr></thead>
          <tbody>{sessions.map((s) => <tr key={s.id} className="border-t border-line/50"><td className="py-2">{s.memberName}</td><td>{new Date(s.startedAt).toLocaleString(locale)}</td><td>{s.endedAt ? new Date(s.endedAt).toLocaleString(locale) : <Badge tone="green" className="!h-5">{tr('Activa')}</Badge>}</td><td className="text-muted">{s.reason ?? ''}</td></tr>)}</tbody>
        </table>
      </Card>
      <Modal open={!!open} onClose={() => setOpen(null)} title={open === 'remove' ? tr('Quitar contraseña') : e.encrypted ? tr('Cambiar contraseña') : tr('Establecer contraseña')} icon="lock" width={440}
        footer={<><Button variant="ghost" onClick={() => setOpen(null)}>{tr('Cancelar')}</Button><Button loading={busy} variant={open === 'remove' ? 'danger' : 'primary'} onClick={() => void submit()}>{open === 'remove' ? tr('Quitar') : tr('Guardar')}</Button></>}>
        <div className="space-y-3">
          {e.encrypted && <Field label={tr('Contraseña actual')}><Input type="password" autoFocus value={cur} onChange={(ev) => setCur(ev.target.value)} /></Field>}
          {open === 'set' && <><Field label={tr('Nueva contraseña')}><Input type="password" value={pw} onChange={(ev) => setPw(ev.target.value)} placeholder={tr('Mínimo 10, con letras y números')} /></Field><Field label={tr('Confirmar')}><Input type="password" value={pw2} onChange={(ev) => setPw2(ev.target.value)} /></Field></>}
          {err && <p className="text-[12px] text-coral">{err}</p>}
          <p className="text-[11.5px] text-amber flex gap-2"><Icon name="alert" size={15} />{tr('Si olvidas la contraseña, tus datos no podrán recuperarse. Guarda una copia de seguridad.')}</p>
        </div>
      </Modal>
    </>
  );
}

function DataTab() {
  const e = useEngine();
  const canBackup = useCan('backup.manage');
  const toast = useApp((s) => s.toast);
  const confirm = useConfirm();
  const [backups, setBackups] = useState<Array<{ name: string; size?: number; date?: string }>>([]);
  const [location, setLocation] = useState('');
  const [integrity, setIntegrity] = useState<{ ok: boolean; messages: string[] } | null>(null);
  const [restorePw, setRestorePw] = useState<{ bytes: Uint8Array; recovery?: boolean } | null>(null);
  const [exp, setExp] = useState<{ pw: string; pw2: string; err: string } | null>(null);
  const doExport = () => {
    if (!exp) return;
    const weak = passwordProblem(exp.pw);
    if (weak) return setExp({ ...exp, err: weak });
    if (exp.pw !== exp.pw2) return setExp({ ...exp, err: tr('Las contraseñas no coinciden.') });
    const pw = exp.pw;
    setExp(null);
    void run(() => exportBackupFile(e, pw), tr('Respaldo exportado'));
  };
  const [pw, setPw] = useState('');
  const refresh = async () => { setBackups(await e.adapter.listBackups()); setLocation(await e.adapter.location()); };
  useEffect(() => { void refresh(); }, []);
  const run = async (fn: () => Promise<unknown>, ok: string) => { try { const r = await fn(); if (r !== null) toast({ kind: 'success', title: ok, body: typeof r === 'string' ? r : undefined }); await refresh(); } catch (x) { toast({ kind: 'error', title: tr('Operación fallida'), body: errorMessage(x) }); } };
  const restore = (bytes: Uint8Array, password?: string) => confirm.ask({ title: tr('¿Restaurar esta copia?'), body: tr('Los datos actuales se reemplazarán. Antes se creará automáticamente una copia de seguridad de lo que tienes ahora.'), confirmLabel: tr('Restaurar'), onConfirm: () => void run(async () => { await restoreFromBytes(e, bytes, password); setRestorePw(null); }, tr('Copia restaurada')) });
  const tryRestore = async (bytes: Uint8Array) => {
    if (isEncrypted(bytes)) return (setPw(''), setRestorePw({ bytes }));
    // Made on another computer (or another Windows account): it opens with that computer's recovery code.
    if (isDeviceEncrypted(bytes) && !(await Engine.validateBytes(bytes)).ok) return (setPw(''), setRestorePw({ bytes, recovery: true }));
    restore(bytes);
  };

  return (
    <>
      <Card hover={false} className="p-6">
        <div className="flex items-start gap-4">
          <IconTile name="shield" color="var(--emerald)" size={44} />
          <div><p className="text-[14px] font-semibold">{tr('Tus datos permanecen en este equipo')}</p><p className="text-[12.5px] text-muted mt-1">{tr('Monto no envía tus datos a ningún servidor; solo consulta GitHub para buscar actualizaciones si lo tienes activado. Base de datos SQLite local en:')}</p><code className="block text-[11.5px] mt-2 bg-surface-2 rounded-[10px] px-3 py-2 break-all">{location}</code></div>
        </div>
      </Card>
      <Card hover={false}>
        <CardHeader title={tr('Copias de seguridad')} subtitle={tr('Se crea una copia automática cada día al abrir Monto')} action={canBackup && <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="secondary" icon="trash" onClick={() => {
            const n = oldBackups(backups).length;
            if (!n) return toast({ kind: 'info', title: tr('No hay copias de más de 15 días') });
            confirm.ask({ title: tr('¿Borrar {n} copia(s) de más de 15 días?', { n }), body: tr('Se eliminan de este equipo y no se pueden recuperar. La copia más reciente siempre se conserva.'), confirmLabel: tr('Borrar'), onConfirm: () => void run(async () => tr('{n} copia(s) eliminada(s)', { n: await deleteOldBackups(e) }), tr('Copias antiguas borradas')) });
          }}>{tr('Borrar copias de más de 15 días')}</Button>
          <Button size="sm" icon="database" onClick={() => void run(() => createBackup(e), tr('Copia creada'))}>{tr('Crear copia ahora')}</Button>
        </div>} />
        <ul className="p-3 max-h-[260px] overflow-y-auto">
          {backups.map((b) => (
            <li key={b.name} className="flex items-center gap-3 px-3 py-2 rounded-[12px] hover:bg-surface-2 text-[12.5px]">
              <Icon name="database" size={16} className="text-muted" />
              <span className="flex-1 truncate">{b.name}</span>
              {b.size && <span className="text-muted">{(b.size / 1024).toFixed(0)}{' '}{tr('KB')}</span>}
              {canBackup && <Button size="sm" variant="secondary" onClick={async () => tryRestore(await e.adapter.readBackup(b.name))}>{tr('Restaurar')}</Button>}
            </li>
          ))}
          {!backups.length && <p className="text-[12.5px] text-muted px-3 py-3">{tr('Aún no hay copias.')}</p>}
        </ul>
      </Card>
      {canBackup && (
        <Card hover={false} className="p-6">
          <p className="text-[14px] font-semibold mb-1">{tr('Exportar e importar')}</p>
          <p className="text-[12.5px] text-muted mb-4">{tr('Mueve tus datos a otro equipo o guarda una copia externa (USB, disco).')}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon="download" onClick={() => setExp({ pw: '', pw2: '', err: '' })}>{tr('Exportar respaldo (.monto)')}</Button>
            <Button variant="secondary" icon="upload" onClick={async () => { const f = await pickBackupFile(); if (f) tryRestore(f.data); }}>{tr('Importar respaldo')}</Button>
            <Button variant="secondary" icon="download" onClick={() => void run(() => exportJSON(e), tr('Datos exportados en JSON'))}>{tr('Exportar JSON')}</Button>
            <Button icon="reports" onClick={() => { sessionStorage.setItem('monto:report-kind', 'all'); useApp.getState().go('reports'); }}>{tr('Exportar tablas (Excel, PDF, Notion)')}</Button>
          </div>
          <p className="text-[11.5px] text-muted mt-3">{tr('El respaldo .monto se exporta siempre cifrado con una contraseña que eliges; la necesitarás para abrirlo en otro equipo. Las copias automáticas usan la llave de este equipo y solo se abren aquí.')}</p>
        </Card>
      )}
      <Card hover={false} className="p-6 flex items-center gap-4">
        <IconTile name="check" color={integrity ? (integrity.ok ? 'var(--emerald)' : 'var(--coral)') : 'var(--blue)'} size={44} />
        <div className="flex-1"><p className="text-[14px] font-semibold">{tr('Integridad de la base de datos')}</p><p className="text-[12.5px] text-muted">{integrity ? (integrity.ok ? tr('Todo en orden: el archivo no está dañado y no hay datos sueltos.') : `${tr('Encontramos problemas. Restaura una copia de seguridad reciente o exporta tus datos.')} ${integrity.messages.join(' · ')}`) : tr('Revisa que tu base de datos esté sana: que el archivo no esté dañado y que no haya datos sueltos.')}</p></div>
        <Button variant="secondary" onClick={() => setIntegrity(e.integrityCheck())}>{tr('Verificar')}</Button>
      </Card>
      <Modal open={!!exp} onClose={() => setExp(null)} title={tr('Contraseña del respaldo')} icon="lock" width={440}
        footer={<><Button variant="ghost" onClick={() => setExp(null)}>{tr('Cancelar')}</Button><Button onClick={doExport}>{tr('Exportar')}</Button></>}>
        <div className="space-y-3">
          <p className="text-[12.5px] text-muted">{tr('El archivo quedará cifrado con AES-256. Sin esta contraseña no se puede abrir: guárdala en un lugar seguro.')}</p>
          <Field label={tr('Contraseña')}><Input type="password" autoFocus value={exp?.pw ?? ''} onChange={(ev) => exp && setExp({ ...exp, pw: ev.target.value, err: '' })} placeholder={tr('Mínimo 10, con letras y números')} /></Field>
          <Field label={tr('Confirmar')} error={exp?.err || undefined}><Input type="password" value={exp?.pw2 ?? ''} onChange={(ev) => exp && setExp({ ...exp, pw2: ev.target.value, err: '' })} /></Field>
        </div>
      </Modal>
      <Modal open={!!restorePw} onClose={() => setRestorePw(null)} title={restorePw?.recovery ? tr('Copia de otro equipo') : tr('Copia cifrada')} icon={restorePw?.recovery ? 'key' : 'lock'} width={restorePw?.recovery ? 520 : 420} footer={<><Button variant="ghost" onClick={() => setRestorePw(null)}>{tr('Cancelar')}</Button><Button onClick={() => restore(restorePw!.bytes, pw)}>{tr('Continuar')}</Button></>}>
        {restorePw?.recovery
          ? <><p className="text-[12.5px] text-muted mb-3">{tr('Esta copia se hizo en otro equipo y está cifrada con su llave. Escribe la clave de recuperación de ese equipo (Configuración → Seguridad → Clave de recuperación).')}</p>
            <Field label={tr('Clave de recuperación')}><Input autoFocus spellCheck={false} value={pw} onChange={(ev) => setPw(ev.target.value)} placeholder="XXXX-XXXX-XXXX-…" className="font-mono" /></Field></>
          : <Field label={tr('Contraseña de la copia')}><Input type="password" autoFocus value={pw} onChange={(ev) => setPw(ev.target.value)} /></Field>}
      </Modal>
      <ResetData />
      {confirm.node}
    </>
  );
}

function CategoriesTab() {
  const canManage = useCan('category.manage');
  const mutate = useMutate();
  const confirm = useConfirm();
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const cats = useQuery((e) => listCategories(e, kind, true), [kind]);
  const [form, setForm] = useState<{ open: boolean; parentId: string | null; id?: string }>({ open: false, parentId: null });
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('other');
  const [color, setColor] = useState('#1F6B4F');
  const top = cats.filter((c) => !c.parentId);
  const save = () => {
    const r = mutate((e, a) => (form.id ? updateCategory(e, a, form.id, { name, icon, color }) : createCategory(e, a, { name, kind, parentId: form.parentId, icon, color })), form.id ? tr('Categoría actualizada') : tr('Categoría creada'));
    if (r !== undefined) setForm({ open: false, parentId: null });
  };
  return (
    <Card hover={false}>
      <CardHeader title={tr('Categorías y subcategorías')} action={<div className="flex gap-2"><Segmented size="sm" value={kind} onChange={setKind} options={[{ value: 'expense', label: tr('Gastos') }, { value: 'income', label: tr('Ingresos') }]} />{canManage && <Button size="sm" icon="plus" onClick={() => { setName(''); setIcon('other'); setColor('#1F6B4F'); setForm({ open: true, parentId: null }); }}>{tr('Nueva')}</Button>}</div>} />
      <ul className="p-3 space-y-1">
        {top.map((c) => (
          <li key={c.id}>
            <div className={clsx('group flex items-center gap-3 px-2 py-2 rounded-[12px] hover:bg-surface-2', c.archived && 'opacity-50')}>
              <IconTile name={c.icon} color={c.color} size={34} />
              <span className="flex-1 text-[13px] font-medium">{c.name} {c.isSystem && <Badge className="!h-5 ml-1">{tr('Predeterminada')}</Badge>}</span>
              {canManage && <span className="flex gap-1 opacity-0 group-hover:opacity-100">
                <Button size="sm" variant="ghost" icon="plus" onClick={() => { setName(''); setIcon(c.icon); setColor(c.color); setForm({ open: true, parentId: c.id }); }}>{tr('Sub')}</Button>
                <Button size="sm" variant="ghost" icon="edit" onClick={() => { setName(c.name); setIcon(c.icon); setColor(c.color); setForm({ open: true, parentId: null, id: c.id }); }} aria-label={tr('Editar')} />
                <Button size="sm" variant="ghost" onClick={() => mutate((e, a) => updateCategory(e, a, c.id, { archived: !c.archived }), c.archived ? tr('Categoría reactivada') : tr('Categoría archivada'))}>{c.archived ? tr('Reactivar') : tr('Archivar')}</Button>
                {!c.isSystem && <Button size="sm" variant="ghost" icon="trash" onClick={() => confirm.ask({ title: tr('¿Eliminar {name}?', { name: c.name }), body: tr('Los movimientos quedarán sin categoría.'), onConfirm: () => mutate((e, a) => deleteCategory(e, a, c.id), tr('Categoría eliminada')) })} aria-label={tr('Eliminar')} />}
              </span>}
            </div>
            {cats.filter((s) => s.parentId === c.id).map((s) => (
              <div key={s.id} className="group flex items-center gap-2 pl-14 pr-2 py-1.5 text-[12.5px] text-ink-2 rounded-[10px] hover:bg-surface-2">
                <span className="size-1.5 rounded-full" style={{ background: c.color }} /><span className={clsx('flex-1', s.archived && 'line-through opacity-60')}>{s.name}</span>
                {canManage && !s.isSystem && <button className="opacity-0 group-hover:opacity-100 text-muted hover:text-coral" onClick={() => mutate((e, a) => deleteCategory(e, a, s.id), tr('Subcategoría eliminada'))} aria-label={tr('Eliminar')}><Icon name="trash" size={14} /></button>}
              </div>
            ))}
          </li>
        ))}
      </ul>
      <Modal open={form.open} onClose={() => setForm({ open: false, parentId: null })} title={form.id ? tr('Editar categoría') : form.parentId ? tr('Nueva subcategoría') : tr('Nueva categoría')} icon="budget" width={520}
        footer={<><Button variant="ghost" onClick={() => setForm({ open: false, parentId: null })}>{tr('Cancelar')}</Button><Button onClick={save}>{tr('Guardar')}</Button></>}>
        <Field label={tr('Nombre')}><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
        {!form.parentId && (
          <>
            <p className="text-[12px] font-medium text-ink-2 mt-4 mb-2">{tr('Icono')}</p>
            <div className="grid grid-cols-10 gap-1.5">{ICON_NAMES.slice(0, 40).map((n) => <button key={n} type="button" onClick={() => setIcon(n)} className={clsx('group grid place-items-center size-9 rounded-[10px] border', icon === n ? 'border-emerald bg-emerald-soft text-emerald' : 'border-line text-ink-2 hover:bg-surface-2')}><Icon name={n} size={17} active={icon === n} /></button>)}</div>
            <p className="text-[12px] font-medium text-ink-2 mt-4 mb-2">{tr('Color')}</p>
            <div className="flex gap-2">{['#1F6B4F', '#C2643E', '#3C6E9E', '#B88A2B', '#2F8A84', '#D0574B', '#5A6FB0', '#8A5CA8', '#A8743F', '#A84B6B', '#6B7A72'].map((c) => <button key={c} type="button" onClick={() => setColor(c)} className={clsx('size-8 rounded-full', color === c && 'ring-4 ring-brand/30 scale-110')} style={{ background: c }} aria-label={c} />)}</div>
          </>
        )}
      </Modal>
      {confirm.node}
    </Card>
  );
}

function AboutTab() {
  const go = useApp((s) => s.go);
  return (
    <Card hover={false} className="p-6 flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-[14px] font-semibold">{tr('Acerca de Monto')}</p><p className="text-[12.5px] text-muted mt-0.5">{tr('Qué es Monto, cómo apoyar el proyecto y lo que viene.')}</p></div>
      <Button icon="info" onClick={() => go('about')}>{tr('Abrir Acerca de')}</Button>
    </Card>
  );
}

function UpdatesTab() {
  const e = useEngine();
  const prefs = useQuery((en) => getPrefs(en));
  const mutate = useMutate();
  const toast = useApp((s) => s.toast);
  const [state, setState] = useState<'idle' | 'checking' | 'none' | 'available' | 'downloading' | 'error'>('idle');
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [err, setErr] = useState('');
  const [progress, setProgress] = useState({ d: 0, t: 0 });
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const supported = updatesSupported();

  const check = async () => {
    setState('checking'); setErr('');
    try {
      const u = await checkForUpdate();
      setInfo(u); setCheckedAt(new Date()); setState(u ? 'available' : 'none');
    } catch (x) { setErr(errorMessage(x)); setState('error'); }
  };
  const install = async () => {
    if (!info) return;
    setState('downloading');
    try {
      await downloadAndInstall(e, info, (d, t) => setProgress({ d, t }));
    } catch (x) {
      setErr(errorMessage(x)); setState('error');
      toast({ kind: 'error', title: tr('No se pudo instalar la actualización'), body: errorMessage(x) });
    }
  };
  const pct = progress.t ? Math.round((progress.d / progress.t) * 100) : 0;

  return (
    <>
      <Card hover={false} className="p-6">
        <div className="flex items-center gap-4">
          <LogoMark size={56} />
          <div className="flex-1">
            <p className="text-[12px] text-muted">{tr('Versión instalada')}</p>
            <p className="text-[20px] font-semibold tracking-[-0.03em] flex items-center gap-2">Monto{' '}{APP_VERSION_LABEL} {IS_PRERELEASE && <Badge tone="amber">{tr('Beta')}</Badge>}</p>
            {checkedAt && <p className="text-[11.5px] text-muted">{tr('Última comprobación:')}{' '}{checkedAt.toLocaleTimeString(locale)}</p>}
          </div>
          <Button icon="refresh" loading={state === 'checking'} disabled={!supported || state === 'downloading'} onClick={() => void check()}>{tr('Buscar actualizaciones')}</Button>
        </div>
        {!supported && <p className="text-[12.5px] text-muted mt-4">{tr('Las actualizaciones están disponibles en la aplicación de escritorio para Windows.')}</p>}
        {state === 'none' && <p className="mt-5 flex items-center gap-2 text-[13px] text-emerald"><Icon name="check" size={16} strokeWidth={2.4} />{tr('Tienes la versión más reciente')}.</p>}
        {state === 'error' && <p className="mt-5 flex items-center gap-2 text-[13px] text-coral"><Icon name="alert" size={16} />{err}</p>}
        {(state === 'available' || state === 'downloading') && info && (
          <div className="mt-5 rounded-[18px] border border-emerald/40 bg-emerald-soft/40 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[15px] font-semibold flex items-center gap-2">{tr('Nueva versión:')}{' '}{versionLabel(info.version)} {info.prerelease && <Badge tone="amber">{tr('Beta')}</Badge>}</p>
                <p className="text-[12px] text-muted">{info.date ? new Date(info.date).toLocaleDateString(locale) : ''}{info.installerSize ? ` · ${(info.installerSize / 1048576).toFixed(1)} MB` : ''}</p>
              </div>
              <Button variant="emerald" icon="download" loading={state === 'downloading'} onClick={() => void install()}>{tr('Descargar e instalar')}</Button>
            </div>
            {info.notes && <pre className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap font-sans text-[12px] text-ink-2 leading-relaxed">{info.notes.slice(0, 3000)}</pre>}
            {state === 'downloading' && (
              <div className="mt-4">
                <div className="h-2 rounded-full bg-surface-3 overflow-hidden"><div className="h-full bg-emerald transition-all" style={{ width: `${pct}%` }} /></div>
                <p className="text-[11.5px] text-muted mt-1">{tr('Descargando y verificando…')}{' '}{pct}{tr('% · Monto se cerrará para completar la instalación.')}</p>
              </div>
            )}
          </div>
        )}
      </Card>
      <Card hover={false} className="p-6 space-y-5">
        <Toggle checked={prefs.autoCheckUpdates !== false} disabled={!supported} onChange={(v) => mutate((en) => setPrefs(en, { autoCheckUpdates: v }), v ? tr('Búsqueda automática activada') : tr('Búsqueda automática desactivada'))}
          label={tr('Avisarme al iniciar si hay una versión nueva')} description={tr('Consulta la página de versiones de Monto en GitHub y te pregunta si quieres descargarla. Nunca se instala sin tu permiso ni se envía ningún dato financiero o personal.')} />
        <div className="rounded-[14px] bg-surface-2 p-4 text-[12px] text-ink-2 leading-relaxed flex gap-3">
          <Icon name="shield" size={18} className="text-emerald shrink-0 mt-0.5" />
          <span>{tr('Cada instalador se descarga desde las versiones oficiales en GitHub y se verifica con su suma')}{' '}<b>SHA-256</b>{' '}{tr('antes de ejecutarse. Antes de instalar se crea una copia de seguridad automática. Tus datos en')}{' '}<code>{tr('%APPDATA%\\com.monto.finanzas')}</code>{' '}{tr('no se modifican.')}</span>
        </div>
      </Card>
    </>
  );
}

import { useEngine, useQuery } from '../../hooks/useDb';
import { useApp } from '../../store/app';
import { Button, Card, CardHeader, PageHeader, Badge } from '../../components/ui';
import { LogoMark } from '../../brand/Logo';
import { Icon } from '../../icons';
import { openProjectPage, type ProjectPage } from '../../services/links';
import { APP_CODENAME, APP_VERSION_LABEL, IS_PRERELEASE } from '../../lib/version';
import { locale, tr } from '../../lib/i18n';

const HIGHLIGHTS: Array<[string, string, string]> = [
  ['lock', tr('Privado y sin conexión'), tr('Tus datos se guardan solo en este equipo, cifrados si pones contraseña.')],
  ['bank', tr('Balboas y dólares'), tr('Pensado para Panamá: PAB y USD, salario quincenal o mensual y décimo tercer mes.')],
  ['family', tr('Para ti, tu pareja o tu hogar'), tr('Varios perfiles e integrantes, cada uno con su parte privada.')],
  ['reports', tr('Tus datos son tuyos'), tr('Exporta a Excel, PDF o Notion y haz copias de seguridad cuando quieras.')],
];

/** Ideas for upcoming releases. Not promises: they can change or move. */
const ROADMAP: Array<{ version: string; name: string; kind: string; items: string[] }> = [
  {
    version: '0.8', name: 'Smart Money', kind: tr('Funciones'),
    items: [
      tr('Importar estados de cuenta (CSV) de los bancos de Panamá con categorías automáticas.'),
      tr('Reglas de categorías: «si dice Super 99, es Alimentación».'),
      tr('Ahorro automático: apartar un % del salario en tu objetivo al marcarlo como recibido.'),
      tr('Avisos de Windows cuando una factura está por vencer.'),
    ],
  },
  {
    version: '0.9', name: 'Calm Design', kind: tr('Diseño'),
    items: [
      tr('Mica real de Windows 11 y un modo compacto para pantallas pequeñas.'),
      tr('Resumen personalizable: elige y ordena tus tarjetas.'),
      tr('«Tu mes en resumen»: un informe visual al cerrar cada mes.'),
      tr('Sincronización cifrada entre tus equipos y una app de celular acompañante.'),
    ],
  },
];

export default function About() {
  const e = useEngine();
  const go = useApp((s) => s.go);
  const dbVersion = useQuery((en) => Number(en.scalar('PRAGMA user_version')));
  const open = (p: ProjectPage) => void openProjectPage(p).catch(() => undefined);
  return (
    <>
      <PageHeader title={tr('Acerca de Monto')} subtitle={tr('Qué es, cómo apoyarlo y lo que viene')} />
      <div className="grid grid-cols-12 gap-5">
        <Card hover={false} className="col-span-12 xl:col-span-7 p-7">
          <div className="flex items-center gap-4">
            <span className="grid place-items-center size-16 rounded-[20px] hero-surface"><LogoMark size={36} tone="light" /></span>
            <div>
              <h2 className="text-[26px] font-bold tracking-[-0.05em] leading-none">monto</h2>
              <p className="text-[13px] text-ink-2 mt-1.5 flex flex-wrap items-center gap-2">{tr('Versión')}{' '}{APP_VERSION_LABEL}{' · '}{APP_CODENAME}{IS_PRERELEASE && <Badge tone="amber">{tr('Beta')}</Badge>}</p>
            </div>
          </div>
          <p className="text-[14px] text-ink-2 mt-5 leading-relaxed max-w-[560px]">{tr('Monto te ayuda a saber cuánto ganas de verdad, en qué se va tu dinero y cuánto puedes ahorrar, sin hojas de cálculo ni cuentas en la nube.')}</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
            {HIGHLIGHTS.map(([icon, title, body]) => (
              <li key={title} className="flex gap-3 rounded-[18px] border border-line/70 p-4">
                <span className="grid place-items-center size-9 shrink-0 rounded-full bg-brand-soft text-brand"><Icon name={icon} size={17} /></span>
                <span><span className="block text-[13px] font-semibold text-ink">{title}</span><span className="block text-[12px] text-muted mt-0.5">{body}</span></span>
              </li>
            ))}
          </ul>
          <p className="text-[11.5px] text-muted mt-6">{tr('Base de datos v')}{dbVersion} · {e.adapter.kind === 'tauri' ? tr('Aplicación de escritorio') : tr('Modo navegador')} · {tr('Último guardado:')}{' '}{e.lastSavedAt ? e.lastSavedAt.toLocaleTimeString(locale) : '—'}</p>
        </Card>

        <Card hover={false} className="col-span-12 xl:col-span-5 p-7">
          <span className="grid place-items-center size-11 rounded-full bg-coral-soft text-coral"><Icon name="heart" size={20} /></span>
          <h3 className="text-[18px] font-semibold tracking-[-0.02em] mt-4">{tr('Apoya el desarrollo')}</h3>
          <p className="text-[13px] text-ink-2 mt-1.5 leading-relaxed">{tr('Monto es un proyecto independiente y gratuito. La mejor forma de apoyarlo es visitar el repositorio, darle una estrella y contar qué te gustaría ver.')}</p>
          <div className="flex flex-col gap-2 mt-5">
            <Button icon="star" onClick={() => open('repo')}>{tr('Ver mi repositorio en GitHub')}</Button>
            <Button variant="secondary" icon="sparkle" onClick={() => open('issues')}>{tr('Sugerir una idea o reportar un problema')}</Button>
            <Button variant="ghost" icon="external" onClick={() => open('releases')}>{tr('Ver todas las versiones')}</Button>
          </div>
          <button onClick={() => go('settings')} className="mt-5 text-[12px] text-brand hover:underline">{tr('Buscar actualizaciones en Configuración')}</button>
        </Card>

        <div className="col-span-12">
          <CardHeader className="!px-1 !pt-0" title={tr('Lo que viene')} subtitle={tr('Ideas para las próximas versiones. No tienen fecha y pueden cambiar.')} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-4">
            {ROADMAP.map((r) => (
              <Card key={r.version} hover={false} className="p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[17px] font-semibold tracking-[-0.02em]">{r.version}{' · '}{r.name}</p>
                  <Badge tone={r.kind === tr('Diseño') ? 'blue' : 'green'}>{r.kind}</Badge>
                </div>
                <ul className="mt-4 space-y-2.5">
                  {r.items.map((it) => <li key={it} className="flex gap-2.5 text-[13px] text-ink-2"><Icon name="check" size={15} className="mt-0.5 shrink-0 text-brand" />{it}</li>)}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

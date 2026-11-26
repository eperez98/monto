import type { RouteKey } from '../../store/app';
import { tr } from '../../lib/i18n';

export interface NavItem { key: RouteKey; label: string; icon: string; hint: string; family?: boolean }

/** Sections grouped by what the user wants to do; `hint` is the one-line "what is this for" shown in the top bar. */
export const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  { title: '', items: [
    { key: 'dashboard', label: tr('Resumen'), icon: 'dashboard', hint: tr('Tu dinero de un vistazo: saldo, gastos y próximos pagos.') },
    { key: 'quotes', label: tr('El Cotizador'), icon: 'quoteSheet', hint: tr('Inventario de cotizaciones y recibos ACH') },
  ] },
  { title: tr('Dinero'), items: [
    { key: 'accounts', label: tr('Cuentas y tarjetas'), icon: 'bank', hint: tr('Bancos, efectivo y tarjetas. El saldo se actualiza con cada movimiento.') },
    { key: 'transactions', label: tr('Movimientos'), icon: 'transactions', hint: tr('Cada ingreso, gasto y transferencia. Pulsa + Movimiento para registrar uno.') },
    { key: 'income', label: tr('Ingresos y salario'), icon: 'salary', hint: tr('Tu salario y otros ingresos, con la fecha del próximo cobro.') },
  ] },
  { title: tr('Planificación'), items: [
    { key: 'plan', label: tr('Plan mensual'), icon: 'planMonth', hint: tr('Anota tus gastos fijos y descubre cuánto puedes ahorrar cada mes.') },
    { key: 'budgets', label: tr('Presupuestos'), icon: 'budget', hint: tr('Pon un límite por categoría y Monto te avisa antes de pasarte.') },
    { key: 'goals', label: tr('Objetivos'), icon: 'goal', hint: tr('Ahorra para algo concreto y sigue tu avance.') },
    { key: 'debts', label: tr('Préstamos y deudas'), icon: 'loan', hint: tr('Lo que debes y lo que te deben, con sus cuotas.') },
    { key: 'calendar', label: tr('Calendario'), icon: 'calendar', hint: tr('Pagos y cobros programados, día por día.') },
  ] },
  { title: tr('Hogar y análisis'), items: [
    { key: 'family', label: tr('Familia'), icon: 'family', family: true, hint: tr('Integrantes del hogar, gastos compartidos y quién debe a quién.') },
    { key: 'reports', label: tr('Informes'), icon: 'reports', hint: tr('Tablas listas para exportar a Excel, PDF o Notion.') },
    { key: 'insights', label: tr('Análisis'), icon: 'insights', hint: tr('Tendencias y consejos a partir de tus datos.') },
  ] },
];

export const NAV_ITEMS: NavItem[] = [
  ...NAV_GROUPS.flatMap((g) => g.items),
  { key: 'settings', label: tr('Configuración'), icon: 'settings', hint: tr('Tema, idioma, seguridad, copias de seguridad y actualizaciones.') },
  { key: 'about', label: tr('Acerca de Monto'), icon: 'info', hint: tr('Qué es Monto, cómo apoyar el proyecto y lo que viene.') },
];

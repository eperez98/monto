# Registro de cambios

Todos los cambios relevantes de Monto se documentan en este archivo.

El formato sigue [Keep a Changelog 1.1.0](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [Versionado Semántico 2.0.0](https://semver.org/lang/es/):

- **MAJOR**: cambios incompatibles (por ejemplo, migraciones de datos no retrocompatibles).
- **MINOR**: funcionalidades nuevas compatibles.
- **PATCH**: correcciones.

## [Sin publicar]

### Corregido
- Resumen «Capas tranquilas»: la tarjeta «Te queda en…» pasa a llamarse «Balance de… (ingresos − gastos)», porque no mide el dinero de tus cuentas sino los ingresos menos los gastos del periodo. Si aún no hay ingresos registrados en el periodo, ya no aparece en rojo y muestra un aviso con el enlace «Marcar salario recibido».

## [0.7.0-beta.4] - 2026-11-13 · GUI Update Fix

Resumen más minimalista y amable, preguntas de gastos más completas y perfiles de pareja.

### Añadido
- **Salario mensual sin deducciones (bruto)**: al configurar tus ingresos puedes indicar, de forma opcional, tu salario antes de descuentos además del neto que recibes.
- **Suscripciones una por una**: el plan mensual pregunta cuántas suscripciones tienes y, para cada una, su nombre, monto y día de cobro.
- **Día de la factura**: para vivienda, luz, agua, gas, internet, préstamos, tarjetas, salud y educación se pregunta qué día llega la factura. Esas fechas alimentan el orden de pagos.
- **Convertir en perfil de pareja** (*Configuración → Perfil*): pide los datos de tu pareja como en la configuración inicial (nombre, ingresos, gastos y cuenta) y la añade al hogar con el rol «Adulto».
- **Crear perfil de pareja externo**: copia tu perfil en uno nuevo y añade allí a tu pareja, sin cambiar tu perfil original.
- **Gastos del mes pagados**: en *Plan mensual*, cada gasto tiene una casilla «Pagado» y, al marcarla, un interruptor «Descontar del saldo actual». Sin el interruptor solo queda marcado como pagado (para lo que pagaste antes de indicar tu saldo); con él se registra el gasto y baja tu saldo. La lista se reinicia cada mes y ahora aparece para todos, no solo para quien cobra una vez al mes.
- **Vista de celular (iOS 27, simulada)**: en *Configuración → Apariencia → Abrir vista de celular* ves Monto dentro de un iPhone, con barra de estado, Dynamic Island y barra inferior de pestañas. Usa una copia temporal de tus datos que no se guarda.
- **Diseño para pantallas estrechas**: por debajo de 768 px el menú lateral se cambia por una barra inferior (Resumen, Movimientos, +, Plan y Más) y las tarjetas se apilan.
- **Tres estilos de resumen**, a elegir al terminar la configuración inicial o en *Configuración → Apariencia*:
  - **Hoy**: una sola respuesta grande, cuánto puedes gastar hoy (tu saldo menos los pagos que faltan este mes, repartido entre los días que quedan), con avisos cortos y el detalle plegado.
  - **Historias**: tres o cuatro frases sobre lo importante (un pago que vence pronto, cuánto ahorras, una categoría que subió o bajó, lo que falta para tu objetivo), cada una con su acción.
  - **Capas tranquilas**: tres números (saldo, gastado y lo que te queda), un solo gráfico que cambia entre meses y categorías, y tus pendientes.

### Cambiado
- El resumen ya no muestra todas las tarjetas a la vez; objetivos, alertas y movimientos recientes quedan en sus secciones. Los usuarios actuales ven el estilo «Capas tranquilas».

## [0.7.0-beta.2] - 2026-11-13

### Añadido
- **Varios perfiles**: en *Configuración → Perfil → Perfiles* puedes crear perfiles nuevos (por ejemplo, uno personal y otro para un negocio), cada uno con sus propios datos, integrantes y contraseña, y abrir cualquiera de ellos. También se puede cambiar de perfil desde la pantalla de bloqueo, la de integrantes y la configuración inicial.
- **Borrar el perfil actual**: el administrador puede borrar todos los datos del perfil abierto. Antes se guarda una copia de seguridad, y después se abre otro perfil o la configuración inicial para crear uno nuevo.
- **Orden de pagos para quien cobra una vez al mes**: en *Plan mensual*, si tu salario es mensual, Monto ordena tus gastos según el día en que vence cada uno a partir de tu día de cobro y muestra cuánto te queda después de cada pago, avisando si el salario no alcanza.

## [0.7.0-beta.1] - 2026-11-07

Rediseño completo con estilo violeta, mejor organización y una guía de inicio.

### Añadido
- **Guía de inicio**: recorrido de 10 pasos que se abre solo la primera vez y resalta cada parte del panel (saldo, acciones rápidas, periodo, Personal/Hogar, secciones, plan mensual, idioma y tema). Se puede repetir desde «Guía de inicio» en el menú lateral, saltar, y navegar con las flechas y Esc.
- **Temas de color** en *Configuración → Apariencia*: **Violeta** (nuevo) o **Clásico** (el verde original), cada uno en modo claro y oscuro.
- **Ayuda en cada sección**: una línea arriba explica para qué sirve la página.
- **Acciones rápidas** en el resumen: Gasto, Ingreso, Transferir y Plan mensual.

### Cambiado
- Nuevo diseño: paleta violeta, tarjetas más redondeadas y botones en píldora; el modo oscuro usa fondos casi negros con tarjetas grafito.
- El saldo disponible se muestra como una tarjeta de débito con degradado; la distribución de gastos es un anillo con el total en el centro.
- Menú lateral agrupado por tarea: *Día a día*, *Planificar* y *Hogar y análisis*.

## [0.6.0] - 2026-11-07 · Security Revision

Versión centrada en seguridad. Primera versión estable (sin «Beta») de Monto.

### Seguridad
- El actualizador solo acepta el paquete oficial de este repositorio (`Monto_<versión>_x64.zip` publicado en `eperez98/monto`) aunque la interfaz le pida otra dirección.
- Las exportaciones a CSV neutralizan los textos que Excel interpretaría como fórmulas (`=`, `+`, `-`, `@`), sin afectar a los importes.
- Tras 5 PIN incorrectos al elegir integrante hay que esperar 30 segundos antes de volver a intentarlo.
- Las acciones de GitHub Actions están fijadas a un commit exacto y `vitest` pasa a la versión 5 (corrige dos avisos críticos que solo afectaban al entorno de desarrollo).

## [0.5.4-beta.7] - 2026-11-07

### Nuevas funcionalidades
- **Exportar a Notion.** En *Informes* hay un botón *Notion* que genera un archivo Markdown con tablas reales: al importarlo en Notion (*Importar → Markdown*) o pegarlo, cada tabla aparece como tabla de Notion.
- **Todos los datos.** Nuevo informe que reúne en un solo archivo tus movimientos, cuentas, ingresos, plan mensual, presupuestos, objetivos, préstamos y pagos recurrentes, listo para Excel, PDF, Notion o CSV. También se abre desde *Configuración → Datos y copias → Exportar tablas*.

### Cambios
- **Diseño minimalista y elegante en las exportaciones.** PDF: página blanca, texto en azul medianoche, líneas finas, un acento dorado, resumen con cifras clave, encabezados que se repiten en cada página y negativos en rojo suave. Excel: sin cuadrícula, encabezado con línea inferior, filas separadas por líneas finas, columnas ajustadas al contenido, **orden y filtros** en cada tabla, encabezado fijo y lista para imprimir.
- Se tradujeron algunos textos que aparecían en español con la interfaz en inglés.

### Documentación
- README nuevo en inglés (`README.md`) y español (`README.es.md`) con portada, galería de capturas y secciones plegables.
- Capturas generadas con datos ficticios por `npm run screenshots` (`scripts/screenshots.mjs`), en ambos idiomas y en modo claro y oscuro.

## [0.5.3-beta.6] - 2026-11-07

### Nuevas funcionalidades
- **Aviso de nueva versión.** Al abrir Monto aparece una ventana si hay una versión nueva en GitHub, con sus notas y dos opciones: *Descargar e instalar* o *Ahora no*. Nada se descarga ni se instala sin tu permiso; con *Ahora no* sigues usando tu versión actual y se te vuelve a preguntar en el próximo inicio.

### Cambios
- La búsqueda de actualizaciones al iniciar viene **activada** por defecto (antes había que activarla). Se puede desactivar en *Configuración → Actualizaciones*. Solo consulta la página de versiones de GitHub; no envía datos.

## [0.5.2-beta.5] - 2026-11-06

### Nuevas funcionalidades
- **Plan mensual de gastos** (nuevo módulo *Plan mensual*, disponible en los modos individual, pareja y familia). Monto pregunta los gastos del mes uno por uno (vivienda, luz, agua, gas, internet, alimentación, transporte, préstamos, tarjetas, salud, educación y entretenimiento) y permite añadir otros. Al terminar resta los gastos del ingreso mensual neto de la persona y muestra el fondo restante, si puede ahorrar y cuánto al mes. Cada integrante tiene su propio plan.
- El plan también forma parte de la configuración inicial, como paso *Gastos* después de *Ingresos*.
- **Modo claro y oscuro con un clic** y **selector de idioma (ES/EN)** en la barra superior y desde la primera pantalla de la configuración inicial. *Configuración → Apariencia* conserva además la opción *Sistema*.

### Cambios
- La primera vez que se abre, Monto arranca en **modo claro** (antes seguía el tema de Windows). Las instalaciones existentes conservan el tema que tenían.
- En la configuración inicial el salario se escribe **neto** (lo que recibes, ya con los descuentos). Ese paso ya no muestra las opciones de descuentos de ley; siguen disponibles al editar la fuente de ingreso en *Ingresos y salario*.

## [0.4.8-beta.3] - 2026-11-06

Primera versión publicada de **Monto**. Incluye todas las funciones de 0.4.8-beta.2 (descritas más abajo) y añade el inglés.

### Nuevas funcionalidades
- **Interfaz en inglés.** Toda la aplicación está disponible en español e inglés: menús, formularios, avisos, mensajes de error, informes exportados, fechas y categorías predeterminadas. La primera vez se usa el idioma de Windows y se puede cambiar en la configuración inicial o en *Configuración → Apariencia*.
- **Instalador bilingüe.** El instalador pregunta el idioma (español o inglés).
- **Descarga en un solo archivo.** Cada versión se publica como `Monto_<versión>_x64.zip` con el instalador, `SHA256SUMS.txt` y `LEEME.txt`. Se deja de publicar el MSI.
- El actualizador integrado descarga ese zip, comprueba su SHA-256 con el que informa GitHub, lo descomprime y verifica el instalador antes de ejecutarlo.

### Cambios
- Las categorías predeterminadas se crean al terminar la configuración inicial, en el idioma elegido. Las bases de datos existentes conservan sus nombres.
- El repositorio pasa a llamarse `eperez98/monto`; el actualizador busca las versiones en el nuevo nombre.
- Los datos de ejemplo de las pruebas y las capturas de pantalla usan nombres ficticios.

### Cambios técnicos
- Sistema de traducción propio (`src/lib/i18n.ts`, `src/lib/locales/en.ts`) sin dependencias nuevas. `npm run i18n:check` lista los textos sin traducir y una prueba automática impide publicar textos sin traducción.

## [0.4.8-beta.2] - 2026-11-06

Versión Beta de **Monto** (0.4.8 Beta 2).

### Nuevas funcionalidades
- **Actualizaciones integradas** (*Configuración → Actualizaciones*): búsqueda manual o automática al iniciar (opcional), canal estable o Beta, notas de la versión, descarga con progreso, verificación SHA-256 contra `SHA256SUMS.txt`, copia de seguridad previa e instalación en modo pasivo conservando los datos.
- Nombre comercial **Monto** (reemplaza a *Balbo*) y logotipo “M” en colores medianoche + oro.
- Número de versión legible en la app (“0.4.8 Beta 2”).
- Licencia MIT.

### Base funcional incluida en esta Beta

Primera versión funcional de **Monto**, una aplicación nueva que reemplaza por completo al antiguo *Salary and Goals Calculator* (Python).

### Nuevas funcionalidades
- Aplicación de escritorio para Windows 10/11 con instalador NSIS y MSI, accesos directos, desinstalador e información de versión.
- Configuración inicial guiada: perfil individual, en pareja o familiar; moneda principal; frecuencia de ingresos; cuenta principal; contraseña opcional.
- Ingresos y salarios: semanal, bisemanal, quincenal (primera y segunda quincena independientes), mensual, por horas, variable/freelance y otros. Cálculo de ingreso por pago, mensual, anual, promedio real, próxima fecha de pago y total recibido en el año.
- Descuentos de ley de Panamá (CSS 9,75 %, Seguro Educativo 1,25 %), descuentos personalizados y décimo tercer mes estimado.
- Confirmación explícita de pagos recibidos; los estimados nunca se registran como recibidos antes de su fecha.
- Movimientos: ingresos, gastos, transferencias, pagos de tarjeta, préstamos recibidos, abonos y reembolsos, con comprobantes adjuntos, responsable, búsqueda, filtros, edición, eliminación e importación CSV.
- Cuentas de ahorro, corrientes, efectivo, tarjetas de crédito y débito, e inversiones en PAB o USD con saldo inicial y saldo actual.
- Categorías y subcategorías predeterminadas y personalizadas.
- Presupuestos mensuales por categoría con alertas al 70 %, 90 % y 100 %.
- Objetivos de ahorro con aportaciones, retiros, fecha objetivo, ritmo actual y celebración al completarlos.
- Préstamos y deudas con cuota, intereses, saldo pendiente, abonos reales y tabla de amortización.
- Finanzas familiares: integrantes, avatares, roles (Administrador, Adulto, Miembro, Solo lectura), permisos aplicados en la capa de datos, vista Personal/Hogar, gastos compartidos con reparto, distribución de responsabilidades, deudas entre integrantes, liquidaciones e historial.
- Calendario financiero con cobros, cuotas, pagos recurrentes y recordatorios.
- Automatizaciones: pagos recurrentes (manuales o automáticos solo en su fecha), detección de duplicados, alertas de presupuesto, recordatorios de pagos, resumen mensual, comparación de hábitos, categorías con gasto elevado y proyecciones de ahorro.
- Informes de ingresos, gastos, flujo de efectivo, ahorros, deudas, categorías, evolución mensual y comparación anual con exportación a Excel, CSV y PDF.
- Seguridad: cifrado AES-256-GCM opcional de toda la base de datos, bloqueo automático por inactividad, bloqueo manual (`Ctrl + L`), PIN por integrante y registro de sesiones.
- Datos: copia de seguridad automática diaria, copias manuales, restauración con validación de integridad, exportación/importación `.monto` y exportación JSON.

### Mejoras visuales
- Identidad visual completa de Monto: logotipo M, icono de Windows, versiones horizontal y vertical, favicon, paleta y tipografía.
- Sistema de iconos propio con estados inactivo, hover y activo.
- Splash animado, transiciones entre módulos, contadores animados, gráficos progresivos, microinteracciones y notificaciones animadas.
- Modo claro, oscuro y automático según Windows; opción para reducir el movimiento.

### Cambios técnicos
- Versionado SemVer pre-release `0.4.8-beta.2` (MSI con versión numérica `0.4.8.2`).
- Arquitectura Tauri 2 + React 18 + TypeScript + Tailwind CSS 4 + Motion + Recharts.
- SQLite (sql.js/WebAssembly) con migraciones versionadas, escritura atómica y validación de integridad.
- 46 pruebas automatizadas (Vitest) y prueba E2E con Playwright.
- GitHub Actions: lint, validación de tipos, pruebas, build web, build de Windows con prueba de instalación y publicación automática de versiones.

### Cambios incompatibles
- Los datos de prueba de la compilación interna *Balbo* (`com.balbo.finanzas`) no se migran.
- Se elimina la aplicación anterior en Python (`SalaryGoals_Modern.py`). Sus datos no se migran.

[Sin publicar]: https://github.com/eperez98/monto/compare/v0.7.0-beta.4...HEAD
[0.7.0-beta.4]: https://github.com/eperez98/monto/releases/tag/v0.7.0-beta.4
[0.7.0-beta.2]: https://github.com/eperez98/monto/releases/tag/v0.7.0-beta.2
[0.7.0-beta.1]: https://github.com/eperez98/monto/releases/tag/v0.7.0-beta.1
[0.6.0]: https://github.com/eperez98/monto/releases/tag/v0.6.0
[0.5.4-beta.7]: https://github.com/eperez98/monto/releases/tag/v0.5.4-beta.7
[0.5.3-beta.6]: https://github.com/eperez98/monto/releases/tag/v0.5.3-beta.6
[0.5.2-beta.5]: https://github.com/eperez98/monto/releases/tag/v0.5.2-beta.5
[0.4.8-beta.3]: https://github.com/eperez98/monto/releases/tag/v0.4.8-beta.3
[0.4.8-beta.2]: https://github.com/eperez98/monto/releases/tag/v0.4.8-beta.2

# Registro de cambios

Todos los cambios relevantes de Monto se documentan en este archivo.

El formato sigue [Keep a Changelog 1.1.0](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [Versionado Semántico 2.0.0](https://semver.org/lang/es/):

- **MAJOR**: cambios incompatibles (por ejemplo, migraciones de datos no retrocompatibles).
- **MINOR**: funcionalidades nuevas compatibles.
- **PATCH**: correcciones.

## [Sin publicar]

## [1.0.2] - 2026-11-22 · 1.0.2b Confianza

Versión de seguridad: recupera tus copias si cambias de equipo, desbloquea Monto con Windows Hello y comprueba cómo lee Monto los correos de tu banco. El instalador estrena imagen.

### Seguridad
- **Clave de recuperación**: en Configuración → Seguridad puedes ver, copiar o guardar en un archivo la llave de este equipo, escrita como 14 grupos de 4 caracteres.
  - Al importar una copia automática hecha en otro equipo, Monto pide esa clave y la abre con ella.
  - Se aceptan minúsculas, espacios y las confusiones habituales (O por 0, I o L por 1). Un dígito de control detecta los errores al copiarla.
- **Desbloqueo con Windows Hello**: si usas contraseña, puedes abrir Monto con tu huella, tu rostro o el PIN de Windows.
  - Se activa en Configuración → Seguridad, escribiendo la contraseña una vez.
  - Windows guarda la contraseña en el Administrador de credenciales y solo la entrega a Monto después de confirmar que eres tú.
  - Al cambiar o quitar la contraseña, o al borrar el perfil, Windows Hello se desactiva solo.
- **Instalador firmado (preparado)**: la publicación en GitHub firma el instalador si el repositorio tiene un certificado de firma de código. Sin certificado sale sin firmar, como hasta ahora.

### Correo del banco
- **Probar un correo**: en Configuración → Correo del banco pega el texto o el HTML de un aviso y mira qué lee Monto: el monto, el comercio, si es gasto o ingreso, y el banco según el remitente. No se guarda ni se envía nada, y funciona sin conectar el correo.

### Instalador
- El asistente de instalación muestra el logo de Monto: una imagen violeta con el lema en la bienvenida y al terminar, y el logo en la cabecera de cada paso. Las imágenes van al doble de resolución para verse nítidas con la escala de pantalla de Windows.

### Acerca de Monto
- Nueva tarjeta sobre **WinNow**, el otro proyecto del autor: limpieza, privacidad y mantenimiento de Windows 10 y 11, con un botón que abre su repositorio en GitHub. También aparece en el README.

### Cambiado
- El panel de novedades muestra lo que salió después de la última versión que viste: quien venga de la 0.8 RC 3 ve lo de la 1.0.1 y la 1.0.2, y quien venga de la 1.0.1, solo lo nuevo.
- La hoja de ruta de «Acerca de Monto» quita la 1.0.2 y añade la 1.3 «Claridad». La firma del instalador queda pendiente del certificado; afinar la lectura con correos reales de cada banco depende de recibir ejemplos.

## [1.0.1] - 2026-11-22 · Release Update

Primera versión estable de Monto. Llega después de la 0.8 RC 3: protege tus datos aunque no uses contraseña, endurece el acceso, se abre a Colombia y a los bancos en línea de EE. UU. y estrena logo, animación de inicio y foto de perfil.

### Seguridad
- **Base de datos protegida siempre**: sin contraseña, el archivo de datos y las copias automáticas se guardan cifrados (AES-256-GCM) con una llave aleatoria de este equipo, guardada en el Administrador de credenciales de Windows y nunca junto a los archivos.
  - Otra app que lea la carpeta de Monto (de notas, de sincronización, un editor) solo ve datos cifrados.
  - Los archivos y copias guardados en claro por versiones anteriores se cifran solos la primera vez que abres esta versión.
- **Contraseña**: los archivos nuevos usan PBKDF2-SHA256 con 600 000 iteraciones (antes 310 000). Los archivos anteriores se vuelven a guardar con el formato nuevo al desbloquear.
- **Contraseñas nuevas más fuertes**: mínimo 10 caracteres, con letras y números, y sin palabras comunes. Las contraseñas que ya tienes siguen funcionando.
- **PIN con hash lento y sal**: los PIN de los integrantes se guardan con PBKDF2 y una sal aleatoria en lugar de SHA-256. Los PIN antiguos se actualizan solos la próxima vez que se usan.
- **Intentos limitados**: después de 5 intentos fallidos de contraseña o PIN, Monto hace esperar 30 s, luego 1 min, 2 min… hasta 15 min. La espera se mantiene aunque cierres la app.
- **HTTPS forzado**: todas las conexiones (actualizaciones y correo del banco) usan un cliente que rechaza `http://` y cualquier redirección insegura antes de enviar nada. La ventana de la app añade `upgrade-insecure-requests` a su política de contenido.
- **Sin claves en el código**: un chequeo nuevo en CI (`npm run secrets:check`) falla si alguien sube una clave de API, un token o una llave privada.
- **Respaldo portátil**: «Exportar respaldo» pide siempre una contraseña y genera un archivo cifrado que se puede abrir en otro equipo. Las copias automáticas solo se abren en este.

### Base de datos
- **Esquema v3**: las monedas admiten pesos colombianos (COP). Las reglas de moneda de 6 tablas se amplían sin copiar ni reescribir ningún dato, y se verifica la integridad justo después.
- **Esquema v4**: cada integrante puede tener foto de perfil. Se guarda dentro de la base de datos, así que también va cifrada.

### Identidad y bienvenida
- **Logo renovado**: una insignia violeta redondeada con una «M» blanca trazada como línea de gráfico y una moneda de oro que sube junto a su pico. Es el mismo en la app, el ícono de Windows, el instalador y el favicon.
- **Animación de inicio nueva**:
  - Manchas de color que aparecen y flotan.
  - El logo se arma solo: la insignia entra, la «M» se dibuja y la moneda cae.
  - «monto» aparece letra por letra, con el lema «tus finanzas, en orden».
  - Respeta la opción de reducir movimiento.
- **Sonido al iniciar**: tres notas suaves que suben, como una moneda que cae. Se genera en la app, sin archivo de audio, y se apaga en Configuración → Apariencia → Inicio.
- **Foto de perfil**: cada integrante puede poner su foto, que se recorta en cuadrado y se reduce a 256 × 256.
  - Se elige en Configuración → Perfil, o desde Familia al editar a un integrante.
  - Se ve en el menú, al elegir quién usa Monto, en Familia y al repartir gastos.
  - Cada quien cambia la suya; para cambiar la de otro hace falta permiso para gestionar integrantes.

### Cuentas y movimientos
- **Ajustar saldo** (Cuentas → abre una cuenta → «Ajustar saldo»):
  - Corrige el saldo actual restando o sumando un monto, o escribiendo el saldo correcto.
  - Muestra el saldo nuevo antes de guardar.
  - No crea un movimiento, así tus gastos e ingresos no cambian.
  - En tarjetas de crédito el monto es la deuda.
- **Depósito y Yappy recibido**: dos accesos nuevos en «Movimiento» que registran un ingreso con la descripción y el método ya puestos, y suman al saldo de la cuenta. «Yappy recibido» solo aparece en perfiles de Panamá. Los dos van a «Otros ingresos».

### Países y bancos
- **País de las cuentas**: la configuración inicial pregunta dónde están tus cuentas, Panamá o Colombia, y con eso elige la moneda y los bancos que ves.
- **Colombia**:
  - Perfiles en pesos (COP) con el formato local «$ 45.000».
  - 20 bancos y billeteras: Bancolombia, Banco de Bogotá, Davivienda, BBVA, Occidente, Nequi, Daviplata, Nu, Lulo y más.
  - Sus correos de aviso se reconocen.
  - Para que los totales no mezclen monedas, en un perfil de Colombia todas las cuentas van en pesos.
- **Bancos en línea de EE. UU.**:
  - Chime, SoFi, Ally, Capital One 360, Discover, Varo, Current, Marcus, Schwab, Revolut, Wise, PayPal, Venmo, Cash App y Zelle.
  - Las cuentas en estos bancos van siempre en dólares.
  - Sus correos de aviso en inglés se leen («You spent $12.34 at…»).
- Los montos con puntos de miles («45.000», «1.250.000») se leen bien en correos, estados de cuenta y al escribirlos.

### Cambiado
- «Acerca de Monto» muestra la hoja de ruta nueva: 1.0.2 «Confianza», 1.1 «Conectado» y 1.2 «Juntos». La 0.9 ya no saldrá por separado: lo planeado para ella llegó en la 0.8 RC 3.

## [0.8.0-rc.3] - 2026-11-21 · Smart Money (Release Candidate 3)

Tercera versión candidata de la 0.8. Trae un diseño nuevo, «Cristal», y adelanta todo lo planeado para la 0.9 «Calm Design»: Mica de Windows 11, modo compacto, un resumen que tú ordenas y «Tu mes en resumen». También lee comprobantes en PDF, reconoce más bancos de Panamá y revisa la vista de celular pantalla por pantalla. En Windows aparece como versión 0.8.0.3.

### Diseño nuevo
- **Cristal** es el diseño base: paneles translúcidos con desenfoque sobre un fondo de color suave, en modo claro y oscuro.
- **Relieve** es un tema extra con materiales reales: papel, cuero con costura, botones con volumen y campos hundidos.
- **Menú expandible**:
  - Ahora es una barra compacta de íconos que deja más espacio a tus datos.
  - Al pasar el cursor se despliega encima del contenido como un panel de cristal y se cierra al elegir una sección.
  - Se puede fijar abierto, y los grupos se pliegan para ver solo lo que usas.
- **Configuración inicial**: un paso nuevo, «Apariencia», pregunta el tema y si quieres modo claro, oscuro o el del sistema, y lo aplica al instante.
- **Novedades**: quien ya usaba Monto ve una vez un panel con diapositivas horizontales y capturas de cada cambio. En la primera diapositiva puede elegir el tema nuevo, y la última cierra con «Usar Monto».
- Los temas Violeta, Clásico y Windows 11 siguen disponibles en Configuración → Apariencia. Si ya habías elegido uno, se mantiene.

### Corregido
- Las ventanas emergentes se dibujan siempre por encima de todo; el efecto de cristal de una tarjeta ya no puede encerrarlas.

### Añadido (adelanto de la 0.9 «Calm Design»)
- **Mica de Windows 11**: con el tema «Windows 11», la app de escritorio usa el material Mica del sistema detrás de la página.
- **Modo compacto** (Configuración → Apariencia → Tamaño): todo un 10 % más pequeño para laptops o ventanas reducidas.
- **Resumen personalizable**: en «Capas tranquilas», «Personalizar resumen» deja mostrar u ocultar cada tarjeta y cambiar su orden. Nueva tarjeta de objetivos de ahorro.
- **Tu mes en resumen**: ahorro del mes, ingresos frente a gastos, cambio frente al mes anterior, las 3 categorías con más gasto y el gasto más grande. Aparece en el Resumen los primeros 10 días de cada mes y siempre en Informes, con flechas para ver otros meses.
- **Más bancos de Panamá**:
  - Los correos de 16 bancos se reconocen por su remitente y el nombre del banco aparece al revisar: Banco General, Banistmo, BAC, Global Bank, Caja de Ahorros, Banco Nacional, Banesco, Multibank y otros.
  - Se leen montos sin moneda («Monto: 45.80») y más formas de nombrar al comercio o al beneficiario.
  - Los estados de cuenta en CSV se leen aunque traigan filas de la cuenta antes de la tabla, columnas «Tipo» con DB/CR o montos negativos entre paréntesis.

### Añadido
- **Comprobantes en PDF**: además de fotos, Monto lee la primera página de un PDF, también con el reconocimiento de texto de Windows y sin conexión.
- **Arrastrar o pegar la foto**: suelta la foto sobre «Subir foto del comprobante» o pégala con Ctrl+V (una captura o una imagen copiada del navegador).
- **La foto junto al formulario**: al revisar los datos leídos, el comprobante se ve a la izquierda para comparar.
- **Campos sin leer en amarillo**: si Monto no encuentra el total, el comercio o la fecha, el campo queda marcado y te dice qué falta.

### Cambiado
- **Copia automática antes de actualizar**: se hace siempre, sin importar el rol del integrante. Si la copia falla, la actualización no empieza.
- **Revisar la base de datos** (Configuración → Datos y copias) explica el resultado en palabras simples y, si hay un problema, qué hacer.
- La insignia de «Acerca de» dice «Candidata» en las versiones candidatas, en lugar de «Beta».

### Corregido
- **Lectura de fotos reales**: entiende el total aunque la foto esté torcida u oscura, y corrige confusiones típicas («9. 10» o «187. eo» se leen como 9.10 y 187.00).
- **Vista de celular**: Configuración, Calendario, Informes, Análisis, Ingresos y el plan mensual ya no cortan contenido ni encima números. Los filtros de Movimientos se acomodan en dos columnas.

## [0.8.0-rc.2] - 2026-11-18 · Smart Money (Release Candidate 2)

Segunda versión candidata de la 0.8: puedes registrar un gasto con la foto del comprobante. En Windows aparece como versión 0.8.0.2.

### Cambiado
- **Nuevo movimiento** empieza preguntando cómo registrarlo: subir la foto del comprobante o ingresar los datos a mano. Los atajos de Ingreso y Transferir siguen yendo directo al formulario.

### Añadido
- **Leer comprobantes**: Monto saca el comercio, la fecha y el total de la foto de un recibo. También elige la categoría con las reglas automáticas y deja la foto adjunta. Siempre revisas los datos antes de registrar.
  - Usa el reconocimiento de texto que trae Windows: la foto se lee en tu computadora y no se sube ni se descarga nada. Solo en la app de escritorio.

## [0.8.0-rc.1] - 2026-11-15 · Smart Money (Release Candidate 1)

Primera versión candidata de la 0.8 «Smart Money»: Monto ordena tus movimientos solo, importa tus estados de cuenta, aparta ahorro de cada salario y te avisa antes de que venza una factura. También trae mejoras para las parejas y un plan mensual más fácil de editar. En Windows aparece como versión 0.8.0.1.

### Añadido
- **Categorías automáticas.** Si la descripción de un movimiento contiene un texto, Monto le pone la categoría: por ejemplo «Super 99» → Alimentación. Crea tus reglas en *Configuración → Categorías → Reglas automáticas*; si ninguna coincide, Monto usa una lista de comercios comunes de Panamá. Se aplican a todo movimiento nuevo sin categoría: manual, de CSV o del correo.
- **Importar estados de cuenta.** El importador de CSV (*Movimientos*) ahora entiende las columnas «Débito» y «Crédito» de los bancos, los años de dos dígitos y los montos con coma decimal (1.234,56). Pone la categoría con las reglas y no duplica lo que ya importaste.
- **Ahorro automático** (*Objetivos*). Elige un objetivo y un porcentaje: cada vez que marques un salario como recibido y sumado a tu saldo, esa parte se aparta en el objetivo, sin pasarte de la meta.
- **Avisos de pagos en Windows** (*Configuración → Apariencia*). Al abrir Monto, una vez al día, una notificación te avisa de los gastos del plan mensual que vencen hoy o en los próximos 2 días y aún no marcaste como pagados.
- **Correo del banco** (opcional, *Configuración → Correo del banco*, solo en la app de escritorio). Conectas Gmail o Outlook una vez con su inicio de sesión oficial; Monto te pregunta cuál es el asunto de los correos que tu banco envía cuando haces una transacción y desde qué fecha buscar. Cada vez que abres Monto busca solo esos correos, de esa fecha en adelante, y te muestra el resultado: correos leídos, movimientos nuevos, duplicados y correos sin monto. Eliges cuáles agregar y puedes cambiarles el nombre antes. Los duplicados (mismo comercio y mismo monto que algo ya registrado, o dos avisos de la misma compra) se marcan y no se modifican. Cada correo se agrega una sola vez. Incluye una guía para obtener el ID de cliente en Google Cloud y en Microsoft.
- **Saldos de la pareja en el resumen.** En un perfil de pareja se ven *Mi saldo*, *Saldo de tu pareja* y *En conjunto*, según las cuentas de cada uno; las compartidas cuentan en el total.
- **Plan mensual de cada uno y en conjunto.** En un perfil de pareja hay pestañas *Mi plan*, *Plan de tu pareja* y *En conjunto*.

### Cambiado
- **Nuevo diseño del plan mensual.** Arriba, el resultado del mes (ingreso, gastos, fondo restante y cuánto puedes ahorrar); debajo, una tarjeta por gasto en el orden de pago, donde editas el monto y la fecha, lo marcas como pagado o lo quitas. Puedes agregar gastos o volver a responder el cuestionario uno por uno.
- En un perfil de pareja los dos ven todas las cuentas. En los perfiles de familia cada integrante sigue viendo solo las suyas y las compartidas.
- La cuenta que se crea para tu pareja se llama «Cuenta de …» en lugar de «Banco General».
- «Acerca de Monto» muestra las ideas para la 0.9 «Calm Design» y la 1.0.

### Corregido
- Perfil de pareja (también el externo): el plan mensual de tu pareja, su cuenta y su saldo no aparecían.
- El plan mensual ya se puede editar directamente, sin repetir todo el cuestionario.

### Seguridad
- **Conexión guardada fuera de Monto.** Para mantener el correo conectado, el acceso (y el secreto de cliente de Google) se guardan en el Administrador de credenciales de Windows, protegido por tu cuenta de Windows. No se guardan en la base de datos ni en las copias de seguridad de Monto, y la interfaz nunca los ve. «Desconectar» los borra y revoca el acceso en Google.
- **Solo se extrae lo necesario.** El permiso es de solo lectura y solo se buscan los correos con el asunto indicado. De cada correo se piden únicamente el asunto, el remitente, la fecha y el texto, nunca los adjuntos. Solo se guarda lo que eliges agregar, y de cada correo importado queda una huella anónima para no repetirlo.
- La conexión con el correo la hace la parte de escritorio de Monto y solo con las direcciones fijas de Google y Microsoft; la interfaz sigue sin poder conectarse a nada. El inicio de sesión vuelve a tu propio equipo (http://127.0.0.1) y se protege con PKCE.
- Nuevo permiso: notificaciones de Windows, para los avisos de pagos (se pueden apagar).

## [0.7.1-beta.1] - 2026-11-14 · Design Update

Una actualización centrada en el diseño y en cuidar tus datos: un inicio más limpio, un tema al estilo Windows 11, la página «Acerca de Monto», más control al registrar tu salario y una base de datos más rápida.

### Añadido
- **Inicio minimalista con carga en esqueleto.** Mientras Monto abre se ve la silueta de la app con un indicador pequeño, en lugar de la animación grande de antes. El inicio tarda menos.
- **Contraseña con el mismo diseño.** Si tu perfil tiene contraseña, se pide en una tarjeta compacta sobre esa silueta; el selector de perfiles sigue disponible ahí.
- **Tema de color «Windows 11»** (*Configuración → Apariencia*), junto a Violeta y Clásico: menú lateral y diálogos acrílicos, un fondo suave al estilo Mica, el azul de acento de Windows, la fuente Segoe UI Variable y esquinas de 8 px. Funciona en modo claro y oscuro.
- **Página «Acerca de Monto»** (botón ⓘ junto a Configuración, o «Más» en el celular): qué es Monto, la versión con su nombre, cómo apoyar el desarrollo (ver el repositorio en GitHub, sugerir ideas o ver todas las versiones) y las ideas para las próximas versiones, 0.8 «Smart Money» y 0.9 «Calm Design».
- **«Agregar a tu balance actual»** al confirmar un salario recibido (*Ingresos y salario*). Viene activado; si lo apagas, el pago solo cuenta como recibido y tu saldo no cambia. Es para el dinero que ya estaba incluido en el saldo que indicaste al crear el perfil.
- **Cobros registrados.** Cada fuente de ingreso muestra sus cobros e indica si se sumaron al saldo. Puedes editarlos o borrarlos; al borrar uno, el pago vuelve a «Pagos por confirmar».
- **Borrar copias de más de 30 días** (*Configuración → Datos*). Pide confirmación y siempre conserva la copia más reciente.

### Cambiado
- **Base de datos v2.** Al abrir Monto se agregan índices para movimientos, cobros de salario, actividad y sesiones, para que las consultas sigan siendo rápidas con más datos. Es automático y no modifica tus datos.

### Corregido
- Ya no se puede registrar dos veces el mismo pago de salario.

### Seguridad
- Revisión de conexiones. La interfaz no puede conectarse a nada fuera de la app: la política de seguridad solo permite su propio origen, y no hay analíticas ni telemetría. Las únicas salidas a internet son la búsqueda opcional de actualizaciones en GitHub, que no envía tus datos, y los botones de «Acerca de Monto», que abren tu navegador solo en tres direcciones fijas del repositorio.
- Los nombres de las copias de seguridad se validan antes de leerlas o borrarlas, para que no puedan apuntar fuera de la carpeta de copias.
- El texto de privacidad en *Configuración → Datos* ahora menciona la consulta de actualizaciones a GitHub.

### Notas
- Las copias de seguridad hechas con esta versión (base de datos v2) no se pueden restaurar en versiones anteriores de Monto.
- Si actualizas desde una versión anterior a la 0.7.0 Beta 6, abre Monto a mano cuando termine el instalador; desde la Beta 6 se vuelve a abrir solo.

## [0.7.0-beta.6] - 2026-11-13

### Corregido
- Monto abre la ventana maximizada en lugar de una ventana centrada de 1440 × 900.
- Al actualizar desde la ventana de aviso, Monto se vuelve a abrir solo cuando termina el instalador.

## [0.7.0-beta.5] - 2026-11-13

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

[Sin publicar]: https://github.com/eperez98/monto/compare/v0.8.0-rc.1...HEAD
[0.8.0-rc.1]: https://github.com/eperez98/monto/releases/tag/v0.8.0-rc.1
[0.7.1-beta.1]: https://github.com/eperez98/monto/releases/tag/v0.7.1-beta.1
[0.7.0-beta.6]: https://github.com/eperez98/monto/releases/tag/v0.7.0-beta.6
[0.7.0-beta.5]: https://github.com/eperez98/monto/releases/tag/v0.7.0-beta.5
[0.7.0-beta.4]: https://github.com/eperez98/monto/releases/tag/v0.7.0-beta.4
[0.7.0-beta.2]: https://github.com/eperez98/monto/releases/tag/v0.7.0-beta.2
[0.7.0-beta.1]: https://github.com/eperez98/monto/releases/tag/v0.7.0-beta.1
[0.6.0]: https://github.com/eperez98/monto/releases/tag/v0.6.0
[0.5.4-beta.7]: https://github.com/eperez98/monto/releases/tag/v0.5.4-beta.7
[0.5.3-beta.6]: https://github.com/eperez98/monto/releases/tag/v0.5.3-beta.6
[0.5.2-beta.5]: https://github.com/eperez98/monto/releases/tag/v0.5.2-beta.5
[0.4.8-beta.3]: https://github.com/eperez98/monto/releases/tag/v0.4.8-beta.3
[0.4.8-beta.2]: https://github.com/eperez98/monto/releases/tag/v0.4.8-beta.2

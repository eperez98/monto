# Cómo contribuir a Monto

¡Gracias por tu interés! Esta guía explica cómo proponer cambios de forma que sean fáciles de revisar y mantener.

## Antes de empezar
1. Busca en *Issues* si el tema ya existe; si no, abre uno describiendo el problema o la propuesta.
2. Para cambios grandes (nuevos módulos, cambios de esquema), acuerda el enfoque en el issue antes de programar.
3. Nunca adjuntes bases de datos reales, copias `.monto`, capturas con datos personales ni credenciales.

## Entorno

Usa Node.js 26 LTS con el npm incluido.

```bash
npm ci
npm run dev          # navegador
npm run tauri dev    # escritorio (requiere Rust)
```

## Flujo de ramas
- `main`: siempre estable y publicable. Solo recibe cambios mediante Pull Request.
- Ramas de trabajo desde `main`:
  - `feat/<descripcion>` — nuevas funcionalidades
  - `fix/<descripcion>` — correcciones
  - `docs/<descripcion>`, `chore/<descripcion>`, `refactor/<descripcion>`
- Desde **1.0.2b**, todas las actualizaciones se publican en el canal estable. La letra final identifica la revisión. Consérvala en el nombre de la versión, en el instalador y en las notas de publicación.
- El responsable del proyecto crea el tag sobre `main` con el nombre público de la revisión (por ejemplo, `v1.0.2.1a`) y publica la entrega como estable en GitHub. El paquete con tag numérico permite que las instalaciones anteriores detecten la misma actualización.

## Mensajes de commit
Se usa [Conventional Commits](https://www.conventionalcommits.org/es/):
```
feat(ingresos): permitir bonos recurrentes
fix(presupuestos): incluir subcategorías en el consumo
docs: actualizar manual de usuario
```
`feat` implica versión MINOR, `fix` PATCH y `feat!`/`BREAKING CHANGE:` MAJOR.

## Convenciones de código
- **TypeScript estricto**; sin `any` salvo justificación.
- **Importes en céntimos** (`number` entero). Nunca uses decimales para dinero; formatea con `formatMoney`.
- **Fechas locales ISO** (`YYYY-MM-DD`) con las utilidades de `src/lib/dates.ts`.
- **Lógica pura en `src/domain/`** (sin React ni SQL) y con pruebas unitarias.
- **Acceso a datos solo en `src/db/repo/`**: validación con Zod y verificación de permisos (`assertCan`) en cada mutación.
- **Interfaz en español** (Panamá), con estados vacíos, errores comprensibles y confirmación de acciones destructivas.
- **Animaciones** con `motion` y respetando `useMotionOK()` (*reduced motion*).
- **Estimaciones** siempre etiquetadas con `<EstimateTag />`.
- Esquema de base de datos: **nunca edites una migración publicada**; añade una nueva al final de `MIGRATIONS` y documenta el cambio en `docs/base-de-datos.md`.

## Estándares de calidad
Antes de abrir un PR deben pasar:
```bash
npm run lint
npm run typecheck
npm test
npm run build
```
Si cambias flujos de la interfaz, ejecuta también `npm run dev` y `npm run e2e`.

## Pull Requests
- Un PR por tema, con descripción del *qué* y el *porqué* y capturas si hay cambios visuales (con datos ficticios).
- Añade o actualiza pruebas.
- Actualiza `CHANGELOG.md` en la sección **[Sin publicar]**.
- Actualiza la documentación afectada (`README.md`, `docs/`).
- La CI (lint, tipos, pruebas, build web y build/instalación de Windows) debe estar en verde.
- Se requiere al menos una revisión aprobada antes de fusionar (*squash merge*).

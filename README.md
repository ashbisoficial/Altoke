# Altoke

Herramienta de gestión de proyectos (tipo Jira) con pizarra colaborativa (tipo Mural), pensada para operar 100% en capas gratuitas (Supabase + Vercel).

## Stack

- Next.js 15 (App Router) + TypeScript
- Prisma + PostgreSQL (Supabase)
- Supabase Auth (email/password + magic link)
- Tailwind CSS con los tokens de marca de Altoke
- `@dnd-kit` para el tablero Kanban (y, más adelante, el mural)

## Puesta en marcha

1. Crea un proyecto gratuito en [supabase.com](https://supabase.com).
2. Copia `.env.example` a `.env` y completa:
   - `DATABASE_URL` / `DIRECT_URL`: Project Settings → Database → Connection string (usa el pooler en `DATABASE_URL` y la conexión directa en `DIRECT_URL`).
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`: Project Settings → API.
3. Instala dependencias y aplica el esquema:
   ```bash
   npm install
   npx prisma migrate dev
   ```
4. Crea dos buckets públicos en Supabase Storage (Storage → New bucket, marca "Public bucket" en cada uno) y añade una policy que permita `INSERT`/`SELECT` a usuarios autenticados:
   - `attachments` — adjuntos de incidencias.
   - `mural` — imágenes subidas al mural.
   (El mural en tiempo real usa Supabase Realtime en modo *Broadcast*, que no necesita configuración adicional — no hace falta activar replicación de tablas.)
5. Arranca el servidor de desarrollo:
   ```bash
   npm run dev
   ```
6. Abre `http://localhost:3000` — te redirige a `/login`. Regístrate desde `/signup`.

## Migraciones automáticas (una sola vez)

Este entorno no tiene acceso de red a Supabase, así que las migraciones no se pueden aplicar desde aquí — pero después de este paso único, nunca más hace falta copiar SQL a mano: un GitHub Action (`.github/workflows/prisma-migrate.yml`) corre `prisma migrate deploy` automáticamente cada vez que se sube un cambio con nuevas migraciones.

1. En GitHub: **Settings → Secrets and variables → Actions → New repository secret**. Crea dos:
   - `DATABASE_URL`
   - `DIRECT_URL`
   (mismos valores que en `.env` / Vercel — la conexión a tu Supabase).
2. Corre el SQL que te haya pasado Claude una última vez en el SQL Editor de Supabase (crea las tablas pendientes y "le avisa" a Prisma que las migraciones anteriores ya se aplicaron a mano, para que no las intente correr de nuevo).
3. Listo. De ahí en adelante, cada `git push` con migraciones nuevas las aplica solo — revisa la pestaña **Actions** del repo si quieres ver el log de cada corrida.

## Estructura

```
app/
  login/, signup/, auth/callback/   → autenticación (Supabase Auth)
  invite/[token]/                   → aceptar una invitación (público, no requiere sesión para verla)
  (app)/                            → grupo de rutas autenticadas, comparten <AppHeader /> (logo, notificaciones, cuenta, salir)
    dashboard/                      → organizaciones y proyectos del usuario
    account/                        → perfil (nombre) y cambio de contraseña
    board/                          → tablero Kanban de un proyecto
    backlog/                        → backlog + sprints, arrastrar incidencias entre ellos
    issues/[id]/                    → detalle de incidencia (comentarios, adjuntos, subtareas, enlaces)
    organizations/[id]/members/     → miembros de la organización + invitar gente nueva
    projects/[id]/workflow/         → editor de estados y transiciones del flujo de trabajo
    projects/[id]/members/          → gestión de miembros y roles del proyecto
    projects/[id]/tests/            → hub de Xray: casos de prueba + planes de prueba del proyecto
    tests/[id]/                     → detalle de un caso de prueba (pasos, precondiciones, requisitos)
    test-plans/[id]/                → matriz de ejecución (casos × ejecuciones) de un plan
    projects/[id]/murals/           → lista de murales del proyecto + crear uno nuevo
  mural/[boardId]/                  → el lienzo colaborativo (pan/zoom, elementos, tiempo real) — fuera del grupo (app), tiene su propia barra de herramientas de pantalla completa
  api/                              → route handlers (REST-ish, con Zod + Prisma transactions)
components/
  ui/                               → botones, inputs
  layout/                           → AppHeader
  notifications/                    → NotificationBell (campanita, dropdown, marcar leídas)
  account/                          → AccountSettings (nombre + contraseña)
  invitations/                      → AcceptInvitation
  organizations/                    → OrgMembersManager (miembros + invitar + invitaciones pendientes)
  board/                            → KanbanBoard, IssueCard, formularios del tablero
  backlog/                          → BacklogBoard, BacklogRow
  issue/                            → IssueDetail y sus secciones (comentarios, adjuntos, enlaces, subtareas)
  workflow/                         → WorkflowEditor
  members/                          → ProjectMembersManager
  tests/                            → TestCaseForm, TestPlanForm, TestCaseDetail, TestMatrix (Xray)
  mural/                            → MuralCanvas (pan/zoom/realtime), MuralElementView (drag/resize)
  dashboard/                        → formularios de organización/proyecto
lib/
  prisma.ts                         → cliente Prisma (singleton)
  supabase/                         → clientes de Supabase (browser, server, middleware, admin)
  auth.ts                           → getSessionUser() — sincroniza el usuario de Supabase con la tabla User
  permissions.ts                    → chequeo de permisos por rol (org y proyecto)
  seed-defaults.ts                  → catálogo de permisos, roles y flujo de trabajo por defecto
  notifications.ts                  → notify() — crea una notificación in-app
prisma/
  schema.prisma                     → esquema completo (identidad, proyectos, workflow, issues, Xray, mural, invitaciones, notificaciones)
```

## Convenciones para seguir añadiendo funcionalidad

- Cada API route valida el body con `zod`, resuelve el usuario con `getSessionUser()` (nunca se acepta `userId`/`reporterId` desde el cliente) y comprueba permisos con `lib/permissions.ts` antes de tocar la base de datos.
- Las operaciones que crean varias filas relacionadas (organización + roles, proyecto + workflow + tipos de incidencia) van dentro de `prisma.$transaction`.
- Los colores/tipografías de marca viven como tokens de Tailwind (`bg`, `surface`, `border`, `ink`, `accent`, `status.*`, `font-heading`, `font-body`, `font-mono`) — no se hardcodean valores hex fuera de `tailwind.config.ts` / `globals.css`.
- La firma visual de "ticket perforado" de las tarjetas de incidencia es la clase utilitaria `.ticket-stub` en `globals.css`.

## Estado actual

Construido: autenticación, organizaciones, proyectos, workflow por defecto, tipos de incidencia, tablero Kanban con drag-and-drop validado contra el workflow, detalle de incidencia (título/descripción/prioridad/asignado/sprint/puntos, comentarios, adjuntos vía Supabase Storage, subtareas, enlaces entre incidencias), backlog con sprints (arrastrar para asignar), editor de estados/transiciones del workflow, gestión de miembros/roles por proyecto, y el módulo **Xray**: casos de prueba (pasos + precondiciones) trazados a requisitos (Historia/Épica) con % de cobertura, planes de prueba, y una matriz de ejecución (casos × ejecuciones, celdas de color por estado: aprobado/fallido/bloqueado/sin ejecutar).

Construido también el **Mural**: lienzo infinito con pan (arrastrar el fondo) y zoom (rueda del mouse / pellizco táctil / botones +−), post-its de color, notas de texto, marcos, imágenes (subidas a Supabase Storage), dibujo libre a mano alzada, mover/redimensionar/recolorear/traer al frente/enviar atrás/eliminar cualquier elemento, colaboración en vivo entre pestañas/usuarios vía Supabase Realtime (canal por mural), y un botón para convertir un post-it en una incidencia real del proyecto.

Construido también **cuenta y colaboración**: cambiar nombre y contraseña (`/account`), invitar gente a una organización (y opcionalmente directo a un proyecto) por **correo real** (vía Supabase) **y** con un **enlace para compartir** — funciona aunque el correo no llegue o el plan gratuito limite el envío, gestión de invitaciones pendientes (copiar enlace, cancelar), y notificaciones dentro de la app (campanita con contador, se dispara cuando te asignan una incidencia, comentan algo tuyo, te añaden a un proyecto o te invitan a una organización).

Pendiente del pedido más reciente: vista de calendario (sprints + fechas de entrega) y una experiencia guiada más simple para dividir tareas grandes en pequeñas, pensada para gente sin experiencia en gestión de proyectos.

## Seguridad y dependencias

- El proyecto se actualizó de Next.js 14 a **15.5.23** para corregir ~21 CVEs conocidas de Next.js (DoS, SSRF, cache poisoning) que no tenían parche disponible en la rama 14.x. `npm audit` queda limpio salvo dos hallazgos sin exposición real en este proyecto:
  - `deepmerge-ts` (vía `prisma`/`@prisma/config`): solo se ejecuta al fusionar el archivo de configuración de Prisma en build/dev time, con un schema que nosotros mismos escribimos — no procesa nada que llegue de una request externa.
  - `postcss@8.4.31` empaquetado *dentro* de `next/` (build interno de Next, distinto del `postcss` de nivel superior del proyecto, que ya está en una versión parcheada): solo procesa el CSS que nosotros mismos escribimos en el build, nunca CSS de un usuario final.
  - Revisa este apartado de vez en cuando (`npm audit`) — si en el futuro se usan `next/image`, Server Actions, `rewrites()` o `next/script`, vale la pena repetir este análisis porque esas superficies sí quedaron cubiertas por varias de las CVEs corregidas.

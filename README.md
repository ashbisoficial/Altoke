# Altoke

Herramienta de gestión de proyectos (tipo Jira) con pizarra colaborativa (tipo Mural), pensada para operar 100% en capas gratuitas (Supabase + Vercel).

## Stack

- Next.js 14 (App Router) + TypeScript
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
4. Crea un bucket público llamado `attachments` en Supabase Storage (Storage → New bucket, marca "Public bucket") y añade una policy que permita `INSERT`/`SELECT` a usuarios autenticados — se usa para los adjuntos de las incidencias.
5. Arranca el servidor de desarrollo:
   ```bash
   npm run dev
   ```
6. Abre `http://localhost:3000` — te redirige a `/login`. Regístrate desde `/signup`.

## Estructura

```
app/
  login/, signup/, auth/callback/   → autenticación (Supabase Auth)
  dashboard/                        → organizaciones y proyectos del usuario
  board/                            → tablero Kanban de un proyecto
  backlog/                          → backlog + sprints, arrastrar incidencias entre ellos
  issues/[id]/                      → detalle de incidencia (comentarios, adjuntos, subtareas, enlaces)
  projects/[id]/workflow/           → editor de estados y transiciones del flujo de trabajo
  projects/[id]/members/            → gestión de miembros y roles del proyecto
  projects/[id]/tests/              → hub de Xray: casos de prueba + planes de prueba del proyecto
  tests/[id]/                       → detalle de un caso de prueba (pasos, precondiciones, requisitos)
  test-plans/[id]/                  → matriz de ejecución (casos × ejecuciones) de un plan
  api/                              → route handlers (REST-ish, con Zod + Prisma transactions)
components/
  ui/                               → botones, inputs
  board/                            → KanbanBoard, IssueCard, formularios del tablero
  backlog/                          → BacklogBoard, BacklogRow
  issue/                            → IssueDetail y sus secciones (comentarios, adjuntos, enlaces, subtareas)
  workflow/                         → WorkflowEditor
  members/                          → ProjectMembersManager
  tests/                            → TestCaseForm, TestPlanForm, TestCaseDetail, TestMatrix (Xray)
  dashboard/                        → formularios de organización/proyecto
lib/
  prisma.ts                         → cliente Prisma (singleton)
  supabase/                         → clientes de Supabase (browser, server, middleware)
  auth.ts                           → getSessionUser() — sincroniza el usuario de Supabase con la tabla User
  permissions.ts                    → chequeo de permisos por rol (org y proyecto)
  seed-defaults.ts                  → catálogo de permisos, roles y flujo de trabajo por defecto
prisma/
  schema.prisma                     → esquema completo (identidad, proyectos, workflow, issues, Xray, mural)
```

## Convenciones para seguir añadiendo funcionalidad

- Cada API route valida el body con `zod`, resuelve el usuario con `getSessionUser()` (nunca se acepta `userId`/`reporterId` desde el cliente) y comprueba permisos con `lib/permissions.ts` antes de tocar la base de datos.
- Las operaciones que crean varias filas relacionadas (organización + roles, proyecto + workflow + tipos de incidencia) van dentro de `prisma.$transaction`.
- Los colores/tipografías de marca viven como tokens de Tailwind (`bg`, `surface`, `border`, `ink`, `accent`, `status.*`, `font-heading`, `font-body`, `font-mono`) — no se hardcodean valores hex fuera de `tailwind.config.ts` / `globals.css`.
- La firma visual de "ticket perforado" de las tarjetas de incidencia es la clase utilitaria `.ticket-stub` en `globals.css`.

## Estado actual

Construido: autenticación, organizaciones, proyectos, workflow por defecto, tipos de incidencia, tablero Kanban con drag-and-drop validado contra el workflow, detalle de incidencia (título/descripción/prioridad/asignado/sprint/puntos, comentarios, adjuntos vía Supabase Storage, subtareas, enlaces entre incidencias), backlog con sprints (arrastrar para asignar), editor de estados/transiciones del workflow, gestión de miembros/roles por proyecto, y el módulo **Xray**: casos de prueba (pasos + precondiciones) trazados a requisitos (Historia/Épica) con % de cobertura, planes de prueba, y una matriz de ejecución (casos × ejecuciones, celdas de color por estado: aprobado/fallido/bloqueado/sin ejecutar).

Pendiente (ver el plan original): zona de Mural (pizarra colaborativa con Supabase Realtime).

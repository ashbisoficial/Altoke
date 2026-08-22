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
4. Arranca el servidor de desarrollo:
   ```bash
   npm run dev
   ```
5. Abre `http://localhost:3000` — te redirige a `/login`. Regístrate desde `/signup`.

## Estructura

```
app/
  login/, signup/, auth/callback/   → autenticación (Supabase Auth)
  dashboard/                        → organizaciones y proyectos del usuario
  board/                            → tablero Kanban de un proyecto
  api/                              → route handlers (REST-ish, con Zod + Prisma transactions)
components/
  ui/                               → botones, inputs
  board/                            → KanbanBoard, IssueCard, formularios del tablero
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

Construido: autenticación, organizaciones, proyectos, workflow por defecto, tipos de incidencia, tablero Kanban con drag-and-drop validado contra el workflow.

Pendiente (ver el plan original): vista de detalle de incidencia, backlog, editor visual de workflow, gestión de roles en la UI, módulo Xray (esquema ya incluido en `schema.prisma`), zona de Mural.

# Altoke

Herramienta de gestión de proyectos (tipo Jira) con pizarra colaborativa (tipo Mural), pensada para operar 100% en capas gratuitas (Firebase + Vercel).

## Stack

- Next.js 15 (App Router) + TypeScript
- Firestore (base de datos, NoSQL) vía Firebase Admin SDK (servidor) y el SDK cliente (solo para el mural en vivo)
- Firebase Auth (email/password + enlace de correo / magic link)
- Firebase Storage (adjuntos de incidencias + imágenes del mural)
- Tailwind CSS con los tokens de marca de Altoke
- `@dnd-kit` para el tablero Kanban y el backlog

## Puesta en marcha

1. Crea un proyecto gratuito en [console.firebase.google.com](https://console.firebase.google.com) (plan Spark).
2. Activa, dentro de la consola del proyecto:
   - **Authentication → Sign-in method**: activa *Correo electrónico/contraseña* y *Enlace de correo electrónico (acceso sin contraseña)*.
   - **Firestore Database**: creala en modo producción.
   - **Storage**: creá el bucket por defecto.
3. Copia `.env.example` a `.env` y completa:
   - `NEXT_PUBLIC_FIREBASE_*`: Configuración del proyecto → tus apps → app web → "Config" (son públicos, van al bundle del navegador).
   - `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`: Configuración del proyecto → Cuentas de servicio → "Generar nueva clave privada" (JSON con esos tres campos — pegá `private_key` tal cual, con los `\n` literales).
   - `RESEND_API_KEY` (opcional, [resend.com](https://resend.com)): correo real de invitación. Sin esto, las invitaciones igual funcionan con el enlace para compartir.
4. Instala dependencias y arrancá:
   ```bash
   npm install
   npm run dev
   ```
5. Abre `http://localhost:3000` — te redirige a `/login`. Regístrate desde `/signup`.

## Índices de Firestore

Firestore no crea solo los índices compuestos ni los de `collectionGroup` — hay que activarlos a mano una vez (clic en "Crear índice" en cada enlace, tardan 1-2 minutos en construirse). Son los que usan las consultas de la app:

| Colección | Campos | Para qué |
|---|---|---|
| `memberships` (collection group) | `userId` asc | listar organizaciones de un usuario, custom claims |
| `members` (collection group) | `userId` asc | listar proyectos de un usuario, custom claims |
| `invitations` | `organizationId` asc, `status` asc, `createdAt` desc | invitaciones pendientes de una organización |
| `notifications` | `userId` asc, `createdAt` desc | campanita de notificaciones |
| `comments` | `issueId` asc, `createdAt` asc | comentarios de una incidencia |
| `attachments` | `issueId` asc, `createdAt` desc | adjuntos de una incidencia |
| `issues` | `parentId` asc, `number` asc | subtareas de una incidencia |
| `issueLinks` | `sourceId` asc, `createdAt` asc | enlaces salientes de una incidencia |
| `issueLinks` | `targetId` asc, `createdAt` asc | enlaces entrantes de una incidencia |
| `issues` | `projectId` asc, `updatedAt` desc | buscador global |
| `apiKeys` | `userId` asc, `createdAt` desc | llaves de API de la cuenta |
| `sprints` | `projectId` asc, `createdAt` asc | backlog |
| `sprints` | `projectId` asc, `createdAt` desc | detalle de proyecto |
| `testRuns` | `testCaseId` asc, `createdAt` desc | historial de un caso de prueba |
| `testExecutions` | `testPlanId` asc, `createdAt` asc | matriz de un plan de pruebas |

Si falta alguno, la ruta de API o página que lo necesita devuelve un error 500 con un enlace directo de Firebase para crearlo — Claude ya te los fue pasando durante la migración.

## Security Rules

`firestore.rules` y `storage.rules` ya están desplegadas contra el proyecto de Firebase (Claude las subió vía la Firebase Rules API). Firestore queda cerrado al cliente por completo salvo una excepción: lectura de `muralElements`, autorizada por custom claims (`projects`/`orgs`) que `lib/firebase/claims.ts` sincroniza en cada escritura de membership — esto es lo que permite que el mural colabore en vivo sin pasar por una ruta de API en cada movimiento del mouse. Todo lo demás (todas las escrituras, y las lecturas con lógica de autorización) sigue pasando por las rutas de API con el Admin SDK, que ignora las Security Rules.

Si en algún momento necesitás cambiar `firestore.rules` o `storage.rules`, editalas en el repo y pedile a Claude que las vuelva a desplegar (no hace falta `firebase-tools` instalado).

## Estructura

```
app/
  login/, signup/, auth/callback/   → autenticación (Firebase Auth)
  invite/[token]/                   → aceptar una invitación (público, no requiere sesión para verla)
  api/auth/session/                 → crea/borra la cookie de sesión a partir de un ID token
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
  api/                              → route handlers (REST-ish, con Zod + Firestore Admin SDK)
components/                         → sin cambios de fondo por la migración (ver detalle más abajo)
lib/
  firebase/
    client.ts                      → SDK cliente de Firebase (browser)
    admin.ts                       → Admin SDK (servidor, bypassa Security Rules) — adminAuth/adminDb/adminStorage
    session.ts / constants.ts      → session cookies (crear/verificar)
    claims.ts                      → sincroniza custom claims (orgs/projects) desde las memberships
    storage.ts                     → sube adjuntos/imágenes del mural
    firestore-utils.ts             → tsToISO() — convierte Timestamp a string ISO para las respuestas JSON
    errors.ts                      → mensajes en español para los códigos de error de Firebase Auth
    middleware.ts                  → chequeo liviano de sesión en el Edge runtime (ver más abajo)
  email.ts                         → Resend, correo real de invitación
  auth.ts                          → getSessionUser() — valida la session cookie y sincroniza users/{uid} en Firestore
  permissions.ts                   → chequeo de permisos por rol (org y proyecto) + getAccessibleProjectIds()
  seed-defaults.ts                 → catálogo de permisos y el set fijo de roles (Admin/Member/Viewer) y flujo de trabajo por defecto
  notifications.ts                 → notify() — crea una notificación in-app
  issue-service.ts                 → createIssue/updateIssue, compartido entre las rutas de sesión y /api/v1
firestore.rules, storage.rules      → Security Rules (ver arriba)
```

## Modelo de datos en Firestore

No hay joins, así que el esquema no es un calco 1:1 del relacional que tenía antes (Prisma/Postgres):

- **Denormalización**: una incidencia guarda una copia de `issueType`, `status`, `assignee` y `reporter` (no solo el id) para que el detalle salga con una sola lectura; `status` se actualiza en cada transición, `assignee` en cada cambio. Los casos de prueba (`testCases/{id}`, mismo id que la incidencia — son 1:1) denormalizan igual.
- **Colecciones top-level con un campo de FK** (`issueId`, `projectId`, etc.) en vez de subcolecciones, para todo lo que tiene su propia ruta de API "por id" sin el id del padre en la URL: `comments`, `attachments`, `labels`, `issueLinks`, `sprints`, `boards`, `muralElements`, `apiKeys`, `testCases`, `testPlans`, `testExecutions`, `testRuns`.
- **El workflow vive embebido** en el propio documento del proyecto (`projects/{id}.workflow.{statuses,transitions}`) — no hay una colección `workflows` aparte. Las rutas `/api/workflows/[id]/...` tratan ese `[id]` como el id del proyecto.
- **Roles fijos**: Admin/Member/Viewer son un catálogo estático en `lib/seed-defaults.ts` (nunca existieron roles personalizados) — una membership solo guarda el nombre del rol como string, sin tabla de roles ni de permisos.
- **Transacciones de Firestore** (`adminDb.runTransaction`) reemplazan `prisma.$transaction` para todo lo que necesita atomicidad: el contador de `issue.key`, crear organización/proyecto con sus defaults, aceptar una invitación, editar el workflow.

## Convenciones para seguir añadiendo funcionalidad

- Cada API route valida el body con `zod`, resuelve el usuario con `getSessionUser()` (nunca se acepta `userId`/`reporterId` desde el cliente) y comprueba permisos con `lib/permissions.ts` antes de tocar Firestore.
- Todo acceso a Firestore desde el servidor pasa por `adminDb` (`lib/firebase/admin.ts`) — nunca el SDK cliente fuera de un componente `"use client"`. El único lugar donde el cliente lee Firestore directo es el listener en vivo del mural (`components/mural/MuralCanvas.tsx`), cubierto por `firestore.rules`.
- Al pasar datos de un documento de Firestore como prop de un Server Component a un Client Component, nunca se spreadea el documento entero — hay que armar el objeto campo por campo (o convertir con `tsToISO`) porque las instancias de `Timestamp` rompen la serialización de React Server Components. `lib/firebase/firestore-utils.ts` tiene el helper para las respuestas JSON de las rutas de API.
- Los colores/tipografías de marca viven como tokens de Tailwind (`bg`, `surface`, `border`, `ink`, `accent`, `status.*`, `font-heading`, `font-body`, `font-mono`) — no se hardcodean valores hex fuera de `tailwind.config.ts` / `globals.css`.
- La firma visual de "ticket perforado" de las tarjetas de incidencia es la clase utilitaria `.ticket-stub` en `globals.css`.

## Estado actual

Construido: autenticación, organizaciones, proyectos, workflow por defecto, tipos de incidencia, tablero Kanban con drag-and-drop validado contra el workflow, detalle de incidencia (título/descripción/prioridad/asignado/sprint/puntos, comentarios, adjuntos vía Firebase Storage, subtareas, enlaces entre incidencias), backlog con sprints (arrastrar para asignar), editor de estados/transiciones del workflow, gestión de miembros/roles por proyecto, y el módulo **Xray**: casos de prueba (pasos + precondiciones) trazados a requisitos (Historia/Épica) con % de cobertura, planes de prueba, y una matriz de ejecución (casos × ejecuciones, celdas de color por estado: aprobado/fallido/bloqueado/sin ejecutar).

Construido también el **Mural**: lienzo infinito con pan (arrastrar el fondo) y zoom (rueda del mouse / pellizco táctil / botones +−), post-its de color, notas de texto, marcos, imágenes (subidas a Firebase Storage), dibujo libre a mano alzada, mover/redimensionar/recolorear/traer al frente/enviar atrás/eliminar cualquier elemento, colaboración en vivo entre pestañas/usuarios vía un listener de Firestore (`onSnapshot`), y un botón para convertir un post-it en una incidencia real del proyecto.

Construido también **cuenta y colaboración**: cambiar nombre y contraseña (`/account`), invitar gente a una organización (y opcionalmente directo a un proyecto) por **correo real** (vía Resend) **y** con un **enlace para compartir** — funciona aunque el correo no llegue o no esté configurado, gestión de invitaciones pendientes (copiar enlace, cancelar), y notificaciones dentro de la app (campanita con contador, se dispara cuando te asignan una incidencia, comentan algo tuyo, te añaden a un proyecto o te invitan a una organización).

Construido también **calendario y tareas más guiadas**: calendario mensual por proyecto (`/projects/[id]/calendar`) con las fechas de entrega de las incidencias y las fechas de cada sprint (editables directo desde el Backlog); en el detalle de una incidencia, una barra de progreso "X de Y completadas" en las subtareas y un aviso amable sugiriendo dividir una Épica/Historia grande en pasos más chicos cuando todavía no tiene ninguna; al crear una incidencia, una explicación en español simple de qué es cada tipo (Épica, Historia, Tarea, Bug, Subtarea); y un contador de subtareas visible directo en la tarjeta del tablero Kanban.

## Limitaciones conocidas (por el cambio a Firestore)

- **Búsqueda** (`/api/search`): sin "contains" case-insensitive ni OR entre campos, trae las incidencias más recientes de los proyectos accesibles (acotado) y filtra en memoria — anda bien a esta escala, no es full-text real.
- **Borrado en cascada**: borrar una incidencia no borra sus subtareas (quedan con un `parentId` apuntando a una incidencia que ya no existe) — Postgres lo hacía automático (`onDelete: Cascade`), Firestore no tiene ese concepto.
- **Datos denormalizados pueden quedar desactualizados**: si renombrás una etiqueta o un estado del workflow, las incidencias que ya lo tenían asignado siguen mostrando el nombre/color viejo hasta que se les toque ese campo de nuevo (no hay un trigger que actualice en cascada, a diferencia de un join SQL que siempre está al día).

## Seguridad y dependencias

- El proyecto se actualizó de Next.js 14 a **15.5.23** para corregir ~21 CVEs conocidas de Next.js (DoS, SSRF, cache poisoning) que no tenían parche disponible en la rama 14.x.
- Al migrar de Prisma a Firestore se fue con él el único hallazgo de `npm audit` que tenía esta app (`deepmerge-ts` vía `@prisma/config`).
- `npm audit` queda con hallazgos en herramientas de build/dev (`tailwindcss` v3 vía `chokidar`/`braces`, `eslint-config-next` vía `fast-glob`, `next` empaquetando una versión vieja de `postcss`/`sharp` para su build interno) — ninguno procesa algo que llegue de una request externa en producción. Revisalo de vez en cuando (`npm audit`) junto con cualquier upgrade de Next/Tailwind/ESLint.

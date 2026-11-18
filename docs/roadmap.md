# Altoke — Roadmap de producto para desarrollo

**Fecha:** 18 nov 2026

## Objetivo y resumen

Altoke debe llegar a ser un reemplazo funcional de Jira para uso propio, con gestión de pruebas integrada (tipo Xray) y pizarra colaborativa (tipo Mural), en cinco fases; la Fase 0 va antes que cualquier funcionalidad nueva.

- **Fase 0 — Fundaciones:** ambiente de pruebas, orden de incidencias, API paginada, ciclo de vida de sprints, deuda técnica.
- **Fase 1 — Núcleo de Jira:** campos personalizados, filtros, reportes, versiones, roadmap, notificaciones.
- **Fase 2 — QA tipo Xray:** resultado por paso, repositorio de pruebas, bug desde prueba fallida, importar resultados automatizados.
- **Fase 3 — Automatización e integraciones:** webhooks, reglas, GitHub, API completa.
- **Fase 4 — Mural y documentos:** wiki enlazado a incidencias, mural conectado al tablero, plantillas.

**Tamaños:** S = hasta 2 días, M = hasta 1 semana, L = más de 1 semana, estimados para un desarrollador.
**Prioridades:** P0 bloquea la fase, P1 es necesaria para cerrarla, P2 es deseable.
El equipo de QA prueba cada entrega contra los criterios de aceptación de este documento.

---

## Posturas: dónde el planteamiento original no se sostiene

Estas decisiones cambian el alcance respecto a "igual y mejor que Jira". Cada una trae su justificación.

1. **"Igual y mejor que Jira" no es un objetivo alcanzable ni medible tal cual.** Jira tiene más de veinte años de desarrollo y un equipo grande; intentar clonarlo entero garantiza no terminar. Propuesta: paridad en el 20% de Jira que cubre el uso diario (tablero, backlog, sprints, filtros, workflow, reportes básicos) y superarlo donde no trae nada integrado: pruebas sin plugin de pago, pizarra, documentos y API abierta. "Mejor" significa menos configuración, no más funciones.
2. **No replicar el sistema de configuración de Jira** (permission schemes, screens, field configurations, issue type schemes). Es la parte más compleja y menos querida de Jira. Altoke ya tiene roles por organización y proyecto; se extiende con campos personalizados por proyecto y nada más.
3. **No clonar JQL primero.** Un lenguaje de consulta propio con parser y autocompletado es una tarea L que no aporta hasta que haya volumen de datos. Primero filtros estructurados y guardados (F1-3); el lenguaje de consulta queda en la Fase 3 y solo si los filtros dejan de alcanzar.
4. **Sin marketplace ni plugins.** Un sistema de plugins exige sandbox, versionado y seguridad, y no se justifica para un equipo de una persona. Se reemplaza por API pública, webhooks y reglas de automatización, que cubren la misma necesidad con una fracción del costo.
5. **Sin Jira Service Management** (SLA, portal de clientes, colas). Es otro producto con otro público.
6. **La capa gratuita es una restricción de diseño, no un detalle.** Supabase y Vercel limitan tamaño de base de datos, almacenamiento, conexiones Realtime y pausan proyectos inactivos; además el plan Hobby de Vercel está pensado para uso no comercial. Los límites y términos cambian: el dev debe confirmarlos antes de la Fase 3. Si Altoke se abre a terceros o se usa comercialmente, el plan gratuito deja de servir y hay que presupuestar infraestructura.
7. **Tiempo real solo en el mural.** Ya existe y vale la pena ahí. En tablero y backlog basta con refrescar al volver a la pestaña; el tiempo real en todo multiplica los casos de prueba concurrentes y el consumo del plan gratuito.
8. **Mejor que lo pedido, a bajo costo:** un wiki de documentos enlazado a incidencias (Jira sin Confluence queda cojo) y un importador de CSV de Jira. Sin importador, nadie migra y QA no tiene datos realistas para probar.
9. **La testabilidad es un requisito del producto, no un favor a QA.** Sin staging, datos semilla y selectores estables, no se puede automatizar. Ver la sección de reglas transversales.
10. **Sin marcas ajenas.** No usar nombres, logos ni estilo de Atlassian ni de Xray en la interfaz. "Inspirado en" es aceptable en documentación interna.

**Lo que sí se mantiene:** el modelo multi-organización con roles ya construido. No se amplía (sin SSO ni facturación) mientras Altoke sea de uso propio.

---

## Estado actual y brechas verificadas

Altoke ya tiene autenticación, organizaciones, proyectos, incidencias, tablero Kanban, backlog con sprints, editor de workflow, calendario, notificaciones in-app, un módulo de pruebas básico, un mural en tiempo real y una API v1 con llaves. Estas brechas, revisadas en el código, condicionan el resto del roadmap.

| Brecha | Evidencia en el código | Consecuencia |
|---|---|---|
| Las incidencias no tienen campo de orden | El modelo `Issue` no tiene `rank`; los listados ordenan por fecha de creación | No se puede priorizar manualmente en backlog ni tablero |
| La API v1 no pagina | El listado de incidencias de un proyecto usa `findMany` sin límite | Respuestas enormes y lentas al crecer |
| Sin límite de uso en llaves de API | No hay rate limiting en ningún endpoint | Una llave filtrada puede agotar el plan gratuito |
| Llaves con todos los permisos del dueño | No existen alcances (scopes) | Inseguro para usarlas desde CI |
| Sprints sin ciclo de vida | El PATCH solo cambia el estado; no limita a un sprint activo ni mueve las incidencias pendientes al completar | Burndown y velocity no son calculables |
| Componentes sin uso | Existen en el esquema, sin API ni pantalla | Funcionalidad a medias |
| Borrado definitivo | No hay borrado lógico; `DELETE` elimina la fila | Pérdida de datos sin papelera |
| Notificaciones solo dentro de la app | No hay envío de correo de notificaciones | Se pierden eventos si no hay sesión abierta |
| Descripciones en texto plano | El campo `description` es `String` | Sin formato, limita documentación y reportes de bugs |
| Resultado de prueba por caso, no por paso | `TestRun` guarda un estado; los pasos son JSON sin estado propio | Brecha principal frente a Xray |
| Historial parcial | `IssueActivity` cubre estado, asignado, prioridad y sprint | Faltan título, descripción, etiquetas y fechas |
| Sin pruebas automatizadas ni CI de calidad | El único workflow de GitHub aplica migraciones; no hay tests ni `data-testid` | Sin red de seguridad al crecer |

---

## Reglas transversales: testabilidad y definición de terminado

Cada ítem del roadmap se considera terminado solo si cumple estas reglas, además de sus criterios de aceptación propios.

- **Ambiente de staging propio:** un proyecto de Supabase separado y despliegues de preview en Vercel. QA nunca prueba contra datos reales.
- **Datos semilla deterministas** (`npm run seed:qa`): una organización, tres usuarios (Admin, Member, Viewer), un proyecto con incidencias en todos los estados y sprints planeado, activo y completado. Debe poder resetearse en menos de un minuto.
- **Selectores estables:** `data-testid` en todo elemento interactivo nuevo, con convención `area-elemento-accion` (por ejemplo `board-card-ALT-12`). Los elementos existentes se actualizan en F0-3.
- **Alternativa al arrastrar y soltar:** toda acción que se haga arrastrando (mover en tablero, ordenar backlog) tiene también un menú "Mover a…" operable con teclado. Es más accesible y mucho menos frágil de automatizar.
- **Contrato de API:** especificación OpenAPI 3 de `/api/v1`, generada desde los esquemas Zod. Los cambios incompatibles solo van en una versión nueva.
- **Errores uniformes:** respuesta `{ error: { code, message, fields? } }` y códigos HTTP correctos (401, 403, 404, 409, 422).
- **CI en cada pull request:** lint, typecheck, build, migraciones sobre una base vacía y los tests del dev. El merge se bloquea si algo falla.
- **Migraciones:** aditivas y con backfill probado en staging; nunca se edita una migración ya aplicada.
- **Feature flags simples** para entregar trabajo incompleto a staging sin exponerlo.
- **Por cada ítem, el dev entrega:** criterios de aceptación, casos borde, matriz de permisos (qué rol puede qué) y una nota de "qué probar".
- **Respaldo:** `pg_dump` programado (por ejemplo con GitHub Actions) antes de la primera migración con datos reales.

---

## Fase 0: fundaciones y deuda técnica

Sin esta fase, QA no puede automatizar y las fases siguientes se construyen sobre un orden de incidencias y un ciclo de sprints que hoy no existen.

| ID | Ítem | Prio | Tam | Criterio de aceptación |
|---|---|---|---|---|
| F0-1 | Staging con base de datos separada y comando de datos semilla | P0 | M | `seed:qa` deja el ambiente en estado conocido; staging y producción no comparten base ni llaves |
| F0-2 | CI en cada pull request (lint, typecheck, build, migraciones sobre base vacía) | P0 | S | Un PR con error de tipos o migración inválida no se puede fusionar |
| F0-3 | `data-testid` en la interfaz existente y menú "Mover a…" como alternativa a arrastrar | P0 | M | Todo botón, campo y tarjeta tiene selector estable; mover una incidencia funciona solo con teclado |
| F0-4 | Campo `rank` en `Issue` (orden fraccionario tipo LexoRank) con backfill por fecha de creación y reorden persistente en backlog y tablero | P0 | M | El orden persiste al recargar y lo ve otro usuario; dos reordenamientos simultáneos no pierden ni duplican posiciones |
| F0-5 | API v1: paginación por cursor, filtros (estado, tipo, asignado, sprint, `updatedSince`), OpenAPI y formato de error uniforme | P0 | M | Ningún listado devuelve más de 100 ítems por página; la especificación valida contra las respuestas reales |
| F0-6 | Ciclo de vida de sprint: iniciar (uno solo activo por proyecto, fechas válidas) y completar (las incidencias sin terminar van al backlog o al siguiente sprint, a elegir) | P0 | M | Iniciar un segundo sprint activo devuelve 409; completar nunca deja incidencias huérfanas |
| F0-7 | Límite de uso y alcances en llaves de API (`read`, `write`, `test-results`), con caducidad opcional | P1 | M | Una llave `read` recibe 403 al escribir; exceder el límite devuelve 429 con `Retry-After`; el almacenamiento del contador funciona en el plan gratuito |
| F0-8 | Borrado lógico y papelera para incidencias, comentarios y casos de prueba, con restaurar | P1 | M | Una incidencia borrada desaparece de listados y búsquedas, se puede restaurar con sus comentarios y enlaces |
| F0-9 | Historial ampliado: título, descripción, etiquetas, fechas | P1 | S | Cada cambio de esos campos genera una entrada con valor anterior y nuevo |
| F0-10 | Componentes: terminar (CRUD, asignar a incidencias, filtrar) o eliminarlos del esquema | P2 | S | Decisión documentada; no queda código ni modelo a medias |
| F0-11 | Tests del dev sobre permisos (matriz rol × acción) y servicios (crear incidencia, transición) | P1 | M | La matriz cubre los 13 permisos con Admin, Member y Viewer; corre en el CI de F0-2 |

---

## Fase 1: paridad con el núcleo de Jira

Al cerrar esta fase, Altoke puede reemplazar a Jira en la gestión diaria de un equipo pequeño. Depende de la Fase 0.

| ID | Ítem | Prio | Tam | Criterio de aceptación |
|---|---|---|---|---|
| F1-1 | Descripción y comentarios en Markdown con vista previa, @menciones y adjuntos en línea | P0 | M | El formato se conserva al recargar; el HTML se sanea (sin XSS); mencionar a alguien le genera notificación |
| F1-2 | Campos personalizados por proyecto: texto, número, fecha, selección, selección múltiple, usuario | P0 | L | Se crean y ordenan desde configuración; aparecen en formulario, detalle y filtros; pueden ser obligatorios |
| F1-3 | Filtros estructurados, filtros guardados y vista de lista (tabla ordenable con columnas elegibles) | P0 | L | Un filtro se comparte por URL estable y devuelve el mismo resultado para quien lo abre, respetando permisos |
| F1-4 | Edición masiva: estado, asignado, sprint, etiquetas, mover de proyecto | P1 | M | Una operación sobre 50 incidencias es atómica por ítem y informa cuáles fallaron y por qué (transición inválida, sin permiso) |
| F1-5 | Configuración de tablero: columnas ligadas a estados, límites WIP, carriles (swimlanes) por asignado o épica, filtros rápidos | P1 | L | Superar el límite WIP se señala visualmente y se puede bloquear por configuración |
| F1-6 | Versiones (releases): crear, asignar "versión de corrección", marcar como liberada, notas de versión automáticas | P1 | M | Las notas listan las incidencias terminadas de la versión, agrupadas por tipo |
| F1-7 | Vista de épicas y roadmap en línea de tiempo, con dependencias por enlaces `BLOCKS` | P1 | L | Cambiar fechas de una épica actualiza la barra; una dependencia incumplida se marca |
| F1-8 | Observadores, correo de notificaciones con preferencias por evento y resumen diario | P1 | M | Cada usuario puede apagar cada tipo de aviso; el proveedor de correo es compatible con la capa gratuita (a decidir) |
| F1-9 | Reportes: burndown, velocity, flujo acumulado, creadas vs resueltas, tiempo en cada estado | P1 | L | Los números coinciden con un cálculo manual sobre los datos semilla; depende de F0-6 y F0-9 |
| F1-10 | Importar y exportar CSV, incluyendo el formato de exportación de Jira | P1 | L | Importar 500 incidencias de Jira conserva claves, estados, tipos, asignados y comentarios; los errores se reportan por fila |
| F1-11 | Registro de tiempo: estimación original, tiempo registrado y restante | P2 | M | Los totales se agregan en épicas y reportes |
| F1-12 | Clonar incidencia, mover entre proyectos y convertir tipo | P2 | M | Se conservan o descartan explícitamente adjuntos, enlaces y campos; el usuario lo ve antes de confirmar |
| F1-13 | Paleta de comandos (Ctrl+K) y atajos de teclado | P2 | M | Crear, buscar y cambiar de proyecto sin mouse |

**Nota de diseño para F1-2:** usar una tabla de definiciones de campo y una columna JSONB con índice en `Issue`, no un modelo clave-valor por fila. Un modelo por fila complica los filtros, los reportes y las importaciones.

---

## Fase 2: gestión de pruebas tipo Xray

El módulo de pruebas pasa de "un resultado por caso" a gestión de pruebas completa, con trazabilidad y resultados automatizados. Es el diferencial de Altoke frente a Jira, que lo cobra aparte, y la base del propio trabajo de QA. Puede avanzar en paralelo a la Fase 1 una vez cerrada la Fase 0.

| ID | Ítem | Prio | Tam | Criterio de aceptación |
|---|---|---|---|---|
| F2-1 | Resultado por paso (estado, comentario, evidencia) y estado del caso derivado de sus pasos | P0 | L | Un caso con un paso fallido queda fallido; los pasos tienen id estable y se pueden reordenar sin perder resultados previos |
| F2-2 | Tipos de prueba: manual, BDD (Gherkin con validación de sintaxis) y automatizada (referencia al script) | P1 | M | Un `.feature` inválido se rechaza con el número de línea del error |
| F2-3 | Repositorio de pruebas: carpetas y Test Sets reutilizables | P0 | M | Un caso puede estar en varios Test Sets; mover carpetas no rompe planes existentes |
| F2-4 | Precondiciones como entidad reutilizable | P1 | M | Editar una precondición se refleja en todos los casos que la usan |
| F2-5 | Ambientes de prueba y ejecuciones por ambiente | P1 | M | El mismo caso tiene resultados independientes por ambiente en una misma ejecución |
| F2-6 | Crear bug desde un paso o caso fallido, con pasos, ambiente y evidencia precargados y vínculo a la prueba | P0 | M | El bug queda enlazado; al re-ejecutar y aprobar, el caso muestra el historial de la falla |
| F2-7 | Historial de ejecuciones por caso y por requisito, con última ejecución y tendencia | P1 | M | Se ve quién ejecutó, cuándo, en qué ambiente y con qué resultado |
| F2-8 | Reportes: trazabilidad requisito → prueba → ejecución → bug, cobertura por sprint y por versión, resumen de ejecución | P0 | L | Un requisito sin pruebas aparece como no cubierto; los totales cuadran con la matriz |
| F2-9 | Importar resultados automatizados: `POST /api/v1/test-executions/import` con JUnit XML, JSON de Playwright y JSON de Cucumber | P0 | L | El resultado se asocia al caso por su clave (por ejemplo `ALT-123` en el nombre o etiqueta); reenviar el mismo archivo no duplica; una clave inexistente se reporta sin abortar el resto |
| F2-10 | Ejecución guiada paso a paso, con cronómetro y adjuntar captura pegando desde el portapapeles | P1 | M | Se puede ejecutar un plan completo sin salir de la pantalla de ejecución |
| F2-11 | Importar y exportar casos (CSV y archivos `.feature`) | P2 | M | Ida y vuelta sin pérdida de pasos ni precondiciones |
| F2-12 | Plan de pruebas por versión con criterios de salida (por ejemplo 100% de críticos aprobados) | P2 | M | El plan indica si cumple o no el criterio y qué casos lo impiden |

**Nota de diseño para F2-1:** modelar los pasos como tabla (`TestStep`) con resultados en `TestStepResult`, en lugar del JSON actual. Los ids estables son lo que permite historial, re-ejecución y reportes por paso. La migración debe convertir los casos existentes.

---

## Fase 3: automatización e integraciones

Altoke deja de ser una isla: se conecta con el código, con el CI y con otras herramientas, y automatiza lo repetitivo. Se reemplaza el marketplace de Jira por API, webhooks y reglas. Antes de empezar, confirmar la situación de hosting (ver pregunta 1).

| ID | Ítem | Prio | Tam | Criterio de aceptación |
|---|---|---|---|---|
| F3-1 | Webhooks salientes (incidencia creada o actualizada, transición, ejecución terminada) con firma HMAC, reintentos y registro de entregas | P0 | L | Un destino caído recibe reintentos con espera creciente; la firma se valida; se bloquean destinos en redes privadas (protección SSRF) |
| F3-2 | Motor de reglas: disparador, condición y acción (por ejemplo "al pasar a Hecho, asignar a QA" o "si falla una prueba crítica, crear bug") | P1 | L | Acciones limitadas a un catálogo (sin código arbitrario); protección contra bucles; registro de cada ejecución con su resultado |
| F3-3 | Integración con GitHub: vincular ramas, pull requests y commits por clave (`ALT-123`), mostrar estado del CI y transición automática al fusionar | P1 | L | Un PR que menciona la clave aparece en la incidencia; fusionar mueve la incidencia al estado configurado |
| F3-4 | API v1 completa (todo lo que hace la interfaz) y una herramienta de línea de comandos mínima para subir resultados desde el CI | P1 | M | Un pipeline de ejemplo sube resultados de Playwright con un solo comando |
| F3-5 | Plantillas de proyecto (Scrum, Kanban, QA) y de workflow | P2 | M | Crear un proyecto desde plantilla deja listos tipos, estados, transiciones y campos |
| F3-6 | Avisos salientes a Slack, Discord o correo disparados por reglas | P2 | M | Se configuran desde una regla, sin código |
| F3-7 | Lenguaje de consulta propio con autocompletado | P2 | L | Solo se emprende si los filtros estructurados dejan de alcanzar; ver postura 3 |

---

## Fase 4: Mural, documentos y otras herramientas combinadas

Aquí está la mezcla que Jira no ofrece en un solo producto: planificar en la pizarra, documentar en un wiki y ejecutar en el tablero, todo enlazado. El mural ya existe; esta fase lo conecta con el resto.

| ID | Ítem | Prio | Tam | Criterio de aceptación |
|---|---|---|---|---|
| F4-1 | Mural ↔ incidencias: tarjeta de incidencia viva en el mural (muestra estado y asignado), creación de incidencias en lote desde post-its seleccionados, mural incrustado en incidencias y documentos | P0 | M | Cambiar el estado en el tablero actualiza la tarjeta del mural; crear 10 incidencias desde 10 post-its deja vínculos en ambos sentidos |
| F4-2 | Documentos (wiki) por proyecto en Markdown, con menciones a incidencias (`@ALT-123`), historial de versiones y búsqueda | P1 | L | Una mención aparece como vínculo con estado actual; el historial permite comparar y restaurar |
| F4-3 | Plantillas de mural: retrospectiva, planificación de sprint, mapa de historias, mapa de riesgos de QA | P1 | M | Crear un mural desde plantilla deja el lienzo listo con marcos y textos guía |
| F4-4 | Mural: presencia (cursores de otros usuarios), conectores y flechas, deshacer y rehacer, exportar a PNG o PDF | P1 | L | Dos usuarios ven los cursores del otro; deshacer revierte solo las acciones propias |
| F4-5 | Paneles configurables con widgets (incidencias por estado, burndown, ejecución de pruebas, cobertura) | P1 | L | Un panel se comparte por enlace y respeta los permisos de quien lo abre; depende de F1-9 y F2-8 |
| F4-6 | Votación y temporizador en mural, para retrospectivas | P2 | S | Votos anónimos por persona con límite configurable |
| F4-7 | Planning poker dentro de la incidencia | P2 | M | Estimación oculta hasta que todos votan; el resultado llena los puntos de historia |
| F4-8 | Formularios de entrada: un formulario que crea incidencias en un proyecto | P2 | M | Un formulario público tiene protección anti-spam; las incidencias llegan a un estado inicial definido |

**Candidatas a evaluar después de la Fase 3, sin compromiso:** objetivos y resultados clave (OKR), y un asistente con IA para detectar incidencias duplicadas o proponer casos de prueba a partir de historias. Se descartan por ahora porque dependen de que el núcleo esté estable y de que haya datos reales sobre los que probarlas.

---

## Fuera de alcance, con motivo

- **Marketplace y plugins de terceros:** exige sandbox, versionado y revisión de seguridad; la API y los webhooks cubren la necesidad.
- **Mesa de ayuda (SLA, portal de clientes, colas):** es otro producto con otro público.
- **SSO/SAML y facturación:** solo tienen sentido si Altoke se abre a otras organizaciones.
- **App móvil nativa:** ya existe una PWA con modo sin conexión; una app nativa duplica el mantenimiento.
- **Copia exacta de esquemas de permisos, pantallas y configuración de campos de Jira:** es complejidad que sus propios usuarios evitan.
- **Tiempo real en tablero y backlog:** cuesta más en pruebas y en consumo del plan gratuito de lo que aporta.
- **Nombres, logos y estilo de Atlassian o Xray en la interfaz:** riesgo de marca sin beneficio.

---

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Límites del plan gratuito (base de datos, almacenamiento, Realtime, pausa por inactividad) | Caídas o pérdida de servicio | Monitorear uso, topes de tamaño en adjuntos, respaldos programados y decidir un plan de pago mínimo antes de la Fase 3 |
| Alcance sin fin ("igual que Jira") | El proyecto nunca cierra | Criterios de aceptación por ítem, alcance congelado por fase y revisión al cerrar cada una |
| Migraciones sobre datos reales (rank, `TestStep`, campos personalizados) | Corrupción o pérdida | Backfill probado en staging, migraciones aditivas, respaldo previo |
| Permisos inconsistentes entre `/api` y `/api/v1` | Fuga de datos entre roles | Tests de matriz rol × endpoint (F0-11) y pasada de QA con rol Viewer en cada entrega |
| Concurrencia en claves de incidencia, orden y mural | Duplicados u orden roto | Transacciones, pruebas de concurrencia por parte de QA |
| Arrastrar y soltar difícil de automatizar | Pruebas frágiles | Acción alternativa "Mover a…" (F0-3) |
| Abuso de llaves de API y webhooks | Saturación, SSRF | Alcances, límite de uso, firma HMAC, bloqueo de redes privadas |
| Dependencia de Supabase (Auth, Realtime, Storage) | Dificultad para migrar | Mantener el acceso aislado en `lib/supabase/` como hoy; no filtrar sus tipos al resto del código |

---

## Preguntas abiertas

Se responden antes de empezar la fase indicada.

1. **Alcance de uso (antes de la Fase 3):** ¿Altoke seguirá siendo de uso propio o de un equipo pequeño, o se abrirá a terceros? Cambia el plan de hosting, las cuotas y los requisitos de seguridad.
2. **Idioma (antes de la Fase 1):** hoy la interfaz está en español. ¿Se agrega internacionalización desde ya? Hacerlo después cuesta más.
3. **Editor de texto (F1-1):** ¿Markdown con vista previa (recomendado, menor costo) o editor visual?
4. **Correo de notificaciones (F1-8):** ¿qué proveedor, dado el límite de la capa gratuita?
5. **Presupuesto de infraestructura:** ¿qué monto mensual es aceptable si se superan los límites gratuitos?
6. **Prioridad dentro de cada fase:** se propone ejecutar todos los P0 antes que los P1. ¿Se confirma?
7. **Entorno de QA:** coordinar con el dev dónde corren las pruebas automatizadas (por ejemplo GitHub Actions contra staging) y quién administra las llaves y los secretos de ese ambiente.

---

## Estado de implementación

Registro de avance por ítem. Se actualiza en cada entrega.

| ID | Estado | Notas |
|---|---|---|
| F0-1 | Pendiente | Requiere crear el proyecto de Supabase de staging y el comando `seed:qa`. |
| F0-2 | Hecho (falta protección de rama) | `.github/workflows/ci.yml`: lint, typecheck, pruebas y build en cada PR; migraciones sobre PostgreSQL vacío y comprobación de deriva. Para bloquear el merge, marcar los jobs `quality` y `migrations` como required en la protección de la rama. |
| F0-3 | Pendiente | `data-testid` y menú "Mover a…". |
| F0-4 | Pendiente | Campo `rank`. |
| F0-5 | Parcial | Hecho: paginación por cursor (máx. 100, por defecto 50), filtros `status`, `type`, `assignee`, `sprint`, `updatedSince`, y errores `{ error: { code, message, fields? } }` en todas las rutas de `/api/v1`. Pendiente: especificación OpenAPI generada desde Zod. |
| F0-6 | Hecho | `POST /api/sprints/:id/start` y `/complete`. Un solo sprint activo por proyecto (409, aplicado también por índice parcial en la base). Completar mueve las incidencias sin terminar a backlog o a un sprint planeado, y registra el cambio en el historial. `PATCH` ya no acepta `status`. |
| F0-7 | Pendiente | Alcances y límite de uso en llaves. |
| F0-8 | Pendiente | Borrado lógico. |
| F0-9 | Pendiente | Historial ampliado. |
| F0-10 | Pendiente | Componentes. |
| F0-11 | Parcial | Infraestructura de pruebas (Vitest) y pruebas de paginación, errores de API v1 y ciclo de vida de sprint. Falta la matriz rol × acción. |

**Cambios que rompen compatibilidad en `/api/v1`** (aceptados por ser de uso personal): los errores pasan de `{ error: "texto" }` a `{ error: { code, message } }`, y el listado de incidencias y proyectos devuelve como máximo 50 ítems por defecto, con `nextCursor` para la siguiente página.

**Cómo correr las pruebas:** `npm test`. Las pruebas de integración (sprints y API v1) necesitan `DATABASE_URL` apuntando a una base PostgreSQL con las migraciones aplicadas; sin esa variable se omiten.

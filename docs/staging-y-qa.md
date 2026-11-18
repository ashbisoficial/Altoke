# Staging, datos de QA y respaldos

Cómo se separa el ambiente de pruebas de producción (F0-1). Los pasos marcados
**(manual)** se hacen una vez en los paneles de Supabase, Vercel y GitHub; no
los puede hacer el repositorio.

## 1. Dos proyectos de Supabase separados (manual)

| | Producción | Staging |
|---|---|---|
| Proyecto Supabase | el actual | uno nuevo, solo para QA |
| Base de datos | la actual | otra base, nunca compartida |
| Llaves (`anon`, `service_role`, `DATABASE_URL`, `DIRECT_URL`) | las de producción | las de staging |
| Variable `ALTOKE_ENV` | no definida o `production` | `staging` |

Regla: ninguna llave de producción aparece en el ambiente de staging, ni en
secretos de GitHub usados por pruebas. `seed:qa` se niega a correr si
`ALTOKE_ENV=production`.

## 2. Despliegues de preview en Vercel (manual)

Cada rama de pull request despliega una preview. Configurar las variables de
entorno de **Preview** con las llaves de staging, y las de **Production** con
las de producción. Así una preview nunca escribe en la base de producción.

## 3. Datos semilla

```bash
# Con DATABASE_URL y DIRECT_URL apuntando a staging (o a la base de CI):
npm run seed:qa
```

Deja la organización `altoke-qa` en estado conocido: tres usuarios (Admin,
Member, Viewer), un proyecto `QA` con 13 incidencias en los cuatro estados,
asignadas, con comentarios, etiquetas y un caso de prueba, y tres sprints
(completado, activo y planeado). Es idempotente y tarda menos de un segundo
en la base de CI; el objetivo era menos de un minuto.

Para que QA pueda **iniciar sesión** con esos usuarios, además definir en el
ambiente de staging:

- `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (del proyecto de staging)
- `QA_PASSWORD` (contraseña compartida de los usuarios de QA)

Sin esas variables el seed solo crea las filas de la base, que sirven para las
pruebas automáticas pero no para iniciar sesión.

## 4. Respaldos

El workflow `.github/workflows/backup.yml` vuelca la base con `pg_dump` cada
semana y sube el archivo como artefacto de la ejecución (14 días de retención).
Hay que definir el secreto `BACKUP_DATABASE_URL` (manual) con la conexión de
**producción**. Ejecutarlo también a mano antes de cualquier migración con
datos reales (`workflow_dispatch`).

Restaurar un respaldo en staging, nunca sobre producción sin revisión:

```bash
gunzip -c altoke-backup.sql.gz | psql "$STAGING_DATABASE_URL"
```

## 5. Migraciones

- Primero se prueban en staging con `prisma migrate deploy`.
- Son aditivas; nunca se edita una migración ya aplicada.
- La de rank, por ejemplo, deja la columna nullable y la rellena con
  `ensureProjectRanks` en la primera lectura.

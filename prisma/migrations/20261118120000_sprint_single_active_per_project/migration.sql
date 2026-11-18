-- F0-6: como máximo un sprint ACTIVE por proyecto.
-- Aditiva: no cambia columnas. Antes de crear el índice se comprueba que no
-- existan datos que lo violen, para fallar con un mensaje claro.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Sprint"
    WHERE "status" = 'ACTIVE'
    GROUP BY "projectId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Hay proyectos con más de un sprint ACTIVE; complétalos o déjalos PLANNED antes de aplicar esta migración';
  END IF;
END $$;

CREATE UNIQUE INDEX "Sprint_one_active_per_project"
  ON "Sprint" ("projectId")
  WHERE "status" = 'ACTIVE';

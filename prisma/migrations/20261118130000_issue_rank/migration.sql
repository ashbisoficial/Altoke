-- F0-4: orden fraccionario de incidencias.
-- Aditiva. La columna es nullable: las incidencias existentes reciben rank
-- con lib/rank-service.ts (backfill por fecha de creación, idempotente).
-- COLLATE "C": el orden debe ser byte a byte para coincidir con el de
-- JavaScript; con una collation de idioma, "a0" y "A0" se ordenarían distinto.
ALTER TABLE "Issue" ADD COLUMN "rank" TEXT COLLATE "C";

-- Varios NULL no chocan en un índice único; los rangos asignados sí son únicos por proyecto.
CREATE UNIQUE INDEX "Issue_projectId_rank_key" ON "Issue" ("projectId", "rank");

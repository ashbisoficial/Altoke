-- F0-8: borrado lógico para incidencias, comentarios y casos de prueba.
-- Aditiva: solo añade columnas nullable. Los registros existentes siguen activos.

ALTER TABLE "Issue" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Comment" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "TestCase" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- F0-10: los componentes no tenían interfaz ni rutas de creación; se eliminan
-- (decisión registrada en docs/roadmap.md). La migración se niega a borrar si
-- ya hay datos, para no perder información sin revisarla.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Component") OR EXISTS (SELECT 1 FROM "IssueComponent") THEN
    RAISE EXCEPTION 'Hay componentes con datos; revísalos antes de eliminar las tablas';
  END IF;
END $$;

DROP TABLE "IssueComponent";
DROP TABLE "Component";

-- F1-2: campos personalizados por proyecto. Aditiva.
-- Definiciones en "CustomField"; valores en una columna JSONB de Issue, con
-- índice GIN (ver la nota de diseño de la hoja de ruta: no un valor por fila).

CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'SELECT', 'MULTI_SELECT', 'USER');

CREATE TABLE "CustomField" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CustomFieldType" NOT NULL,
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomField_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomField_projectId_name_key" ON "CustomField"("projectId", "name");
CREATE INDEX "CustomField_projectId_position_idx" ON "CustomField"("projectId", "position");

ALTER TABLE "CustomField" ADD CONSTRAINT "CustomField_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Issue" ADD COLUMN "customFields" JSONB NOT NULL DEFAULT '{}';
CREATE INDEX "Issue_customFields_idx" ON "Issue" USING GIN ("customFields");

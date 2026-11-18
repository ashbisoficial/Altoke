-- F0-7: alcances, caducidad y límite de uso en llaves de API. Aditiva.

CREATE TYPE "ApiKeyScope" AS ENUM ('READ', 'WRITE', 'TEST_RESULTS');

-- Las llaves existentes conservan todos los alcances: ya se usan así y no
-- deben romperse. Las nuevas empiezan solo con READ (default de abajo).
ALTER TABLE "ApiKey" ADD COLUMN "scopes" "ApiKeyScope"[] NOT NULL
  DEFAULT ARRAY['READ', 'WRITE', 'TEST_RESULTS']::"ApiKeyScope"[];
ALTER TABLE "ApiKey" ALTER COLUMN "scopes" SET DEFAULT ARRAY['READ']::"ApiKeyScope"[];

ALTER TABLE "ApiKey" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "ApiKey" ADD COLUMN "requestsPerMinute" INTEGER NOT NULL DEFAULT 120;

CREATE TABLE "ApiKeyWindow" (
    "apiKeyId" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ApiKeyWindow_pkey" PRIMARY KEY ("apiKeyId", "windowStart")
);

ALTER TABLE "ApiKeyWindow" ADD CONSTRAINT "ApiKeyWindow_apiKeyId_fkey"
  FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

/**
 * Menciones con @ en descripciones y comentarios (F1-1).
 *
 * Una mención es "@" seguido de un nombre sin espacios (o la parte de
 * usuario del correo), por ejemplo `@ana` o `@ana.perez`. Se resuelve contra
 * los miembros de la organización al guardar. Sin coincidencia, no es mención.
 */

const MENTION_RE = /(^|[^\p{L}\p{N}_@])@([\p{L}\p{N}_.-]{2,64})/gu;

/** Minúsculas y sin tildes: "Ana Pérez" y "perez" deben poder compararse. */
function normalizeKey(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Tokens de mención tal como aparecen en el texto, normalizados y sin duplicados. */
export function extractMentionTokens(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(MENTION_RE)) {
    found.add(normalizeKey(match[2]).replace(/\.$/, ""));
  }
  return [...found];
}

type Member = { id: string; name: string | null; email: string };

/** Nombre normalizado para comparar con un token: sin espacios, en minúsculas. */
export function mentionKeysOf(member: Member): string[] {
  const keys = new Set<string>();
  if (member.name) keys.add(normalizeKey(member.name).replace(/\s+/g, ""));
  keys.add(normalizeKey(member.email.split("@")[0]));
  return [...keys];
}

/** Ids de los miembros mencionados, sin el autor del texto. */
export function resolveMentions(text: string, members: Member[], actorId?: string): string[] {
  const tokens = new Set(extractMentionTokens(text));
  const ids = new Set<string>();
  for (const member of members) {
    if (member.id === actorId) continue;
    if (mentionKeysOf(member).some((k) => tokens.has(k))) ids.add(member.id);
  }
  return [...ids];
}

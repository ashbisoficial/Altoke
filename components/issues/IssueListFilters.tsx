import { COLUMNS, PRIORITIES, type ParsedListQuery } from "@/lib/issue-query";

type Option = { id: string; name: string };
type CustomDef = { id: string; name: string; type: string; options: string[] | null };

const PRIORITY_LABEL: Record<(typeof PRIORITIES)[number], string> = {
  HIGHEST: "Máxima",
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
  LOWEST: "Mínima",
};

const COLUMN_LABEL: Record<(typeof COLUMNS)[number], string> = {
  key: "Clave",
  title: "Título",
  type: "Tipo",
  status: "Estado",
  priority: "Prioridad",
  assignee: "Asignado",
  sprint: "Sprint",
  storyPoints: "Puntos",
  dueDate: "Fecha límite",
  updatedAt: "Actualizada",
};

/**
 * Formulario de filtros: un GET normal, así que el resultado queda en la URL
 * y se puede compartir. No necesita JavaScript.
 */
export function IssueListFilters({
  projectId,
  query,
  rawParams,
  statuses,
  types,
  sprints,
  labels,
  people,
  customFields,
}: {
  projectId: string;
  query: ParsedListQuery;
  rawParams: URLSearchParams;
  statuses: Option[];
  types: Option[];
  sprints: Option[];
  labels: Option[];
  people: Option[];
  customFields: CustomDef[];
}) {
  const sortValue = query.sort ? `${query.sort.dir === "desc" ? "-" : ""}${query.sort.field}` : "";
  const hasFilters =
    query.q ||
    query.statuses.length ||
    query.types.length ||
    query.assignees.length ||
    query.sprints.length ||
    query.priorities.length ||
    query.labels.length ||
    Object.keys(query.custom).length;

  return (
    <form method="get" action={`/projects/${projectId}/issues`} className="shadow-soft flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 text-xs" data-testid="issue-list-filters">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          Buscar
          <input name="q" defaultValue={query.q} className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm" data-testid="issue-list-filter-q" />
        </label>
        <label className="flex flex-col gap-1">
          Orden
          <select name="sort" defaultValue={sortValue} className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm" data-testid="issue-list-filter-sort">
            <option value="">Predeterminado</option>
            <option value="key">Clave ↑</option>
            <option value="-key">Clave ↓</option>
            <option value="title">Título ↑</option>
            <option value="-title">Título ↓</option>
            <option value="status">Estado ↑</option>
            <option value="priority">Prioridad ↑</option>
            <option value="-updatedAt">Actualizada (reciente primero)</option>
            <option value="dueDate">Fecha límite ↑</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <MultiSelect name="status" label="Estado" options={statuses} selected={query.statuses} testId="issue-list-filter-status" />
        <MultiSelect name="type" label="Tipo" options={types} selected={query.types} testId="issue-list-filter-type" />
        <MultiSelect
          name="assignee"
          label="Asignado"
          options={[{ id: "none", name: "Sin asignar" }, ...people]}
          selected={query.assignees}
          testId="issue-list-filter-assignee"
        />
        <MultiSelect
          name="sprint"
          label="Sprint"
          options={[{ id: "none", name: "Backlog" }, ...sprints]}
          selected={query.sprints}
          testId="issue-list-filter-sprint"
        />
        <MultiSelect
          name="priority"
          label="Prioridad"
          options={PRIORITIES.map((p) => ({ id: p, name: PRIORITY_LABEL[p] }))}
          selected={query.priorities}
          testId="issue-list-filter-priority"
        />
        <MultiSelect name="label" label="Etiqueta" options={labels} selected={query.labels} testId="issue-list-filter-label" />
      </div>

      {customFields.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {customFields.map((def) => (
            <label key={def.id} className="flex flex-col gap-1">
              {def.name}
              {def.type === "SELECT" || def.type === "MULTI_SELECT" ? (
                <select name={`cf.${def.id}`} defaultValue={query.custom[def.id] ?? ""} className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm" data-testid={`issue-list-filter-cf-${def.name.toLowerCase().replace(/\s+/g, "-")}`}>
                  <option value="">Cualquiera</option>
                  {(def.options ?? []).map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  name={`cf.${def.id}`}
                  type={def.type === "NUMBER" ? "number" : def.type === "DATE" ? "date" : "text"}
                  defaultValue={query.custom[def.id] ?? ""}
                  className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm"
                  data-testid={`issue-list-filter-cf-${def.name.toLowerCase().replace(/\s+/g, "-")}`}
                />
              )}
            </label>
          ))}
        </div>
      )}

      <fieldset className="flex flex-wrap gap-3">
        <legend className="mb-1 font-medium">Columnas</legend>
        {COLUMNS.map((c) => (
          <label key={c} className="flex items-center gap-1">
            <input type="checkbox" name="cols" value={c} defaultChecked={query.columns.includes(c)} data-testid={`issue-list-column-${c}`} />
            {COLUMN_LABEL[c]}
          </label>
        ))}
      </fieldset>

      <div className="flex items-center gap-3">
        <button type="submit" className="rounded-lg bg-accent px-3 py-1.5 font-medium text-accentInk" data-testid="issue-list-apply">
          Aplicar
        </button>
        {hasFilters && (
          <a href={`/projects/${projectId}/issues`} className="text-accent hover:underline" data-testid="issue-list-clear">
            Limpiar filtros
          </a>
        )}
        <span className="ml-auto truncate text-ink/40" title={rawParams.toString()}>
          {rawParams.toString() ? "Filtro activo" : ""}
        </span>
      </div>
    </form>
  );
}

function MultiSelect({
  name,
  label,
  options,
  selected,
  testId,
}: {
  name: string;
  label: string;
  options: Option[];
  selected: string[];
  testId: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      {label}
      <select name={name} multiple size={Math.min(5, Math.max(2, options.length))} defaultValue={selected} className="min-w-40 rounded-lg border border-border bg-bg px-2 py-1 text-sm" data-testid={testId}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

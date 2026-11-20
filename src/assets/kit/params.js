// Paramètres d'asset : complète les valeurs manquantes avec les défauts du schéma `meta.params` et les borne.

/**
 * @param {Record<string, {type: string, default: any, min?: number, max?: number, values?: string[]}>} schema
 * @param {Record<string, any>} [given]
 */
export function resolveParams(schema, given = {}) {
  const result = {};
  for (const [name, spec] of Object.entries(schema)) {
    let value = given[name] ?? spec.default;
    if (spec.type === "int" || spec.type === "number") {
      value = Number(value);
      if (!Number.isFinite(value)) value = spec.default;
      if (spec.type === "int") value = Math.round(value);
      if (spec.min !== undefined) value = Math.max(spec.min, value);
      if (spec.max !== undefined) value = Math.min(spec.max, value);
    } else if (spec.type === "enum" && !spec.values.includes(value)) {
      value = spec.default;
    } else if (spec.type === "boolean") {
      value = Boolean(value);
    }
    result[name] = value;
  }
  return result;
}

import type { FilterRow } from "@/components/leads/FiltersDrawer";

/** Applies the "More filters" conditions (FiltersDrawer) — same semantics as the Jobs list. */
export function matchesAdvanced(record: Record<string, string>, filters: FilterRow[]): boolean {
  return filters.every(f => {
    const val = String(record[f.column] ?? "").toLowerCase();
    const fv = f.value.toLowerCase();
    switch (f.operator) {
      case "contains":         return val.includes(fv);
      case "does_not_contain": return !val.includes(fv);
      case "equals":           return val === fv;
      case "does_not_equal":   return val !== fv;
      case "starts_with":      return val.startsWith(fv);
      case "ends_with":        return val.endsWith(fv);
      case "is_empty":         return val === "";
      case "is_not_empty":     return val !== "";
      default:                 return true;
    }
  });
}

/** Case-insensitive "any of these fields contains the query". */
export const matchesQuery = (q: string, ...fields: (string | undefined | null)[]) => {
  const s = q.trim().toLowerCase();
  return !s || fields.some(f => (f ?? "").toLowerCase().includes(s));
};

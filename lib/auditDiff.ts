/** Which saved collections are written to the audit log when a record changes. */
export const AUDITED_KINDS = new Set([
  "customers", "contacts", "assets", "workOrders", "estimates", "jobs", "workspaces", "historicInvoices",
  "parts", "partRequests", "partReturns", "paymentSettings",
]);

/** Fields that change constantly and say nothing on their own (the activity trail is itself a log). */
const NOISY = new Set(["activity", "photosSeeded"]);
const MAX_VALUE = 200;
const MAX_META = 4000;

/** A short, safe copy of a value for the log: long text is cut and embedded files (photos, signatures) are not stored. */
export function summarise(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.startsWith("data:")) return "[file]";
    return value.length > MAX_VALUE ? `${value.slice(0, MAX_VALUE)}…` : value;
  }
  if (value && typeof value === "object") {
    const text = JSON.stringify(value, (_k, v) => (typeof v === "string" && v.startsWith("data:") ? "[file]" : v)) ?? "";
    return text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE)}…` : JSON.parse(text);
  }
  return value;
}

export type RecordDiff = { changed: string[]; before: Record<string, unknown>; after: Record<string, unknown> };

/** The top-level fields that differ between two saved copies of a record (null = the record did not exist). */
export function diffRecords(beforeJson: string | null, afterJson: string | null): RecordDiff {
  const parse = (j: string | null): Record<string, unknown> => { try { const v = j ? JSON.parse(j) : {}; return v && typeof v === "object" ? v : {}; } catch { return {}; } };
  const a = parse(beforeJson), b = parse(afterJson);
  const changed: string[] = [];
  const before: Record<string, unknown> = {}, after: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (NOISY.has(key)) continue;
    if (JSON.stringify(a[key]) === JSON.stringify(b[key])) continue;
    changed.push(key);
    if (key in a) before[key] = summarise(a[key]);
    if (key in b) after[key] = summarise(b[key]);
  }
  return { changed, before, after };
}

/** The meta text stored with an audit row, never longer than the limit. */
export function auditMeta(diff: RecordDiff, extra: Record<string, unknown> = {}): string {
  const full = JSON.stringify({ ...extra, changed: diff.changed, before: diff.before, after: diff.after });
  if (full.length <= MAX_META) return full;
  return JSON.stringify({ ...extra, changed: diff.changed, note: "Values too long to store" });
}

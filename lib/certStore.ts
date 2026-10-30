/**
 * Technician certifications, loaded from the server for the dispatch screen.
 * Rule: once any certification is recorded for a service type, only technicians holding a certification for that type
 * that is still valid on the visit date can be assigned to it.
 */
type Cert = { technician: string; name: string; serviceType: string; expiresOn: number };
let certs: Cert[] = [];

export async function loadCerts(): Promise<void> {
  const res = await fetch("/api/certifications").catch(() => null);
  if (!res?.ok) return;
  const rows: { technician: string; name: string; serviceType: string; expiresOn: string }[] = await res.json();
  certs = rows.map(c => ({ ...c, expiresOn: Date.parse(c.expiresOn) }));
}

/** Returns why the technician cannot take this work on that date, or null when they can. */
export function certProblem(technician: string, serviceType: string, visitStart: number): string | null {
  const forType = certs.filter(c => c.serviceType === serviceType);
  if (forType.length === 0) return null;
  const mine = forType.filter(c => c.technician === technician);
  if (mine.length === 0) return `${technician} has no ${serviceType} certification on file.`;
  if (!mine.some(c => c.expiresOn > visitStart)) return `${technician}'s ${serviceType} certification (${mine[0].name}) expires before this visit.`;
  return null;
}

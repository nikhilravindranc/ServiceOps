/** Browser-side helper for the /api/geocode route. Resolves to null when the address cannot be placed or the lookup fails. */
export async function geocodeQuery(query: string): Promise<{ lat: number; lng: number } | null> {
  if (query.trim().length < 5) return null;
  try {
    const res = await fetch("/api/geocode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
    if (!res.ok) return null;
    const d = await res.json();
    return d.found ? { lat: d.lat, lng: d.lng } : null;
  } catch { return null; }
}

export const customerAddress = (c: { street: string; cityLine: string }) => [c.street, c.cityLine].filter(Boolean).join(", ");

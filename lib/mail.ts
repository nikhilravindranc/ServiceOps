/**
 * Email adapter. With RESEND_API_KEY set it sends through Resend; otherwise it logs the message to the
 * server console and reports `delivered: false` so callers can show the link in development.
 */
export const appUrl = () => process.env.APP_URL ?? "http://localhost:3100";

export async function sendMail(to: string, subject: string, text: string): Promise<{ delivered: boolean }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`\n[mail:stub] to=${to}\n${subject}\n${text}\n`);
    return { delivered: false };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "ServiceOps <no-reply@example.com>", to, subject, text }),
  });
  if (!res.ok) console.error("[mail] send failed", res.status, await res.text());
  return { delivered: res.ok };
}

/** In development with no mail provider, links are returned to the page so the flow can be tested. */
export const devLink = (delivered: boolean, url: string) =>
  !delivered && process.env.NODE_ENV !== "production" ? url : undefined;

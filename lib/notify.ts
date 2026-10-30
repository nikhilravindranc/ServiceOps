import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";

export type Channel = "email" | "sms" | "whatsapp";

/**
 * Sends one customer notification and records it.
 * - email: sent through Resend when RESEND_API_KEY is set (status "sent"); otherwise handled by the built-in test provider.
 * - sms and whatsapp: no real provider is connected yet, so the built-in test provider handles them.
 * "test" means the message was accepted by the test provider and can be read in Settings, Delivery log. Nothing left the server.
 */
export async function notify(orgId: string, channel: Channel, event: string, recipient: string, subject: string, body: string) {
  let status: "sent" | "test" | "failed" = "test";
  if (channel === "email" && recipient) {
    try { status = (await sendMail(recipient, subject, body)).delivered ? "sent" : "test"; } catch { status = "failed"; }
  }
  await db.notificationLog.create({ data: { orgId, channel, event, recipient: recipient || "(no address)", subject, body, status } });
  return status;
}

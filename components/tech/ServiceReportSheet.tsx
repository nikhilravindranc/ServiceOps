"use client";
import type { JobRecord, JobWorkspace } from "@/lib/jobsData";
import { checklistFor } from "@/lib/checklists";
import { effectiveSignOff, signOffSummary } from "@/lib/techFlow";
import { customerByName, fmtDate, fmtTime, money, workOrderForJob, jobCharges } from "@/lib/serviceData";

const label = { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#777", marginBottom: 4 } as const;

/** The line under the signature box: who signed and in what capacity, or why there is no signature. */
function signLine(ws: JobWorkspace): string {
  const s = effectiveSignOff(ws);
  if (!s) return "Not signed off";
  if (s.kind === "customer") return `Customer: ${s.name ?? ws.signature?.name ?? ""}${ws.signature ? ` · ${ws.signature.at}` : ""}`;
  if (s.kind === "other") return `${s.name} (${s.role}), signing for the customer${ws.signature ? ` · ${ws.signature.at}` : ""}`;
  return s.kind === "refused" ? "No signature: customer refused" : "No signature: nobody on site";
}

/** Printable service report: what was found, done and used, with the customer's sign-off. Print it, or save it as PDF from the print dialog. */
export default function ServiceReportSheet({ job, ws, problem }: { job: JobRecord; ws: JobWorkspace; problem: string }) {
  const cust = customerByName(job.customer);
  const wo = workOrderForJob(job.id);
  const items = checklistFor(job.serviceType);
  const c = jobCharges(job);
  const start = ws.workStartedAt, end = ws.workEndedAt;
  const mins = start && end ? Math.max(1, Math.round((end - start) / 60000)) : null;

  return (
    <div className="job-print-sheet" style={{ color: "#111", fontFamily: "Arial, Helvetica, sans-serif", fontSize: 12, lineHeight: 1.45 }}>
      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #111", paddingBottom: 10, marginBottom: 14 }}>
        <div><div style={{ fontSize: 18, fontWeight: 800 }}>ServiceOps</div><div style={{ fontSize: 11, color: "#555" }}>Service report</div></div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{job.jobId}</div>
          <div style={{ fontSize: 11, color: "#555" }}>{wo ? `${wo.number}${wo.requestNumber ? ` · ${wo.requestNumber}` : ""}` : ""}</div>
          <div style={{ fontSize: 10, color: "#777" }}>{end ? `${fmtDate(end)}, ${fmtTime(end)}` : fmtDate(Date.now())}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 28, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={label}>Customer</div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{job.customer}</div>
          {cust && <div style={{ color: "#444" }}>{cust.street}, {cust.cityLine}</div>}
          {cust && <div style={{ color: "#444" }}>{cust.phone} · {cust.email}</div>}
        </div>
        <div style={{ flex: 1 }}>
          <div style={label}>Visit</div>
          <div>Technician: <b>{job.technician}</b></div>
          <div>Trade: {job.serviceType}</div>
          <div>Arrived / started: {start ? fmtTime(start) : "—"}</div>
          <div>Finished: {end ? fmtTime(end) : "—"}{mins ? ` (${mins} min on site)` : ""}</div>
        </div>
      </div>

      <div style={label}>Work requested</div>
      <p style={{ margin: "0 0 12px" }}><b>{job.jobName}.</b> {problem}</p>

      <div style={label}>Checklist</div>
      <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 12 }}>
        <tbody>{items.map((it, i) => (
          <tr key={it.label} style={{ borderBottom: "1px solid #E5E5E5" }}>
            <td style={{ padding: "3px 0" }}>{it.label}{it.mandatory ? " *" : ""}</td>
            <td style={{ padding: "3px 0", textAlign: "right", fontWeight: 600 }}>{ws.checks?.[i] ? "Done" : "Not done"}</td>
          </tr>))}</tbody>
      </table>

      <div style={label}>Parts and materials used</div>
      {c.parts.length ? (
        <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 12 }}><tbody>{c.parts.map((p, i) => (
          <tr key={i} style={{ borderBottom: "1px solid #E5E5E5" }}><td style={{ padding: "3px 0" }}>{p.item}</td><td style={{ textAlign: "right" }}>× {p.qty}</td><td style={{ textAlign: "right", width: 90 }}>{money(p.qty * p.rate)}</td></tr>))}</tbody></table>
      ) : <p style={{ margin: "0 0 12px" }}>None recorded.</p>}

      <div style={label}>Technician notes</div>
      {ws.notes.length ? ws.notes.map(n => <p key={n.id} style={{ margin: "0 0 4px" }}>{n.text}</p>) : <p style={{ margin: 0 }}>No notes.</p>}
      <p style={{ margin: "8px 0 0", color: "#555" }}>{ws.photos.length} photo{ws.photos.length === 1 ? "" : "s"} attached to the job.</p>

      {ws.payment && <p style={{ margin: "10px 0 0" }}>Payment: {money(ws.payment.amount)} by {ws.payment.method}{ws.payment.reference ? ` (ref ${ws.payment.reference})` : ""}.</p>}

      <div style={{ marginTop: 22, padding: "8px 10px", border: "1px solid #111" }}>
        <div style={label}>Sign-off</div>
        <div style={{ fontWeight: 700 }} data-testid="report-signoff">{signOffSummary(ws)}</div>
        {ws.outcome && <div>Visit not finished: {ws.outcome.reason}{ws.outcome.note ? `. ${ws.outcome.note}` : ""}</div>}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
        <div style={{ width: 240 }}>
          {ws.signature ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={ws.signature.dataUrl} alt="Signature" style={{ height: 60, display: "block" }} /> : <div style={{ height: 60 }} />}
          <div style={{ borderTop: "1px solid #111", paddingTop: 4, fontSize: 11 }}>{signLine(ws)}</div>
        </div>
        <div style={{ width: 200, alignSelf: "flex-end" }}><div style={{ borderTop: "1px solid #111", paddingTop: 4, fontSize: 11, textAlign: "right" }}>Technician: {job.technician}</div></div>
      </div>
    </div>
  );
}

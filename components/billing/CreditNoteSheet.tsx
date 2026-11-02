"use client";
import { fmtDate, customerByName, type Invoice } from "@/lib/serviceData";
import { usd } from "@/lib/ledger";

export interface CreditNotePrint { invoice: Invoice; creditNumber: string }

const label = { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#777", marginBottom: 4 } as const;

function Row({ label: l, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ padding: "4px 12px 4px 0", color: "#555", whiteSpace: "nowrap", verticalAlign: "top" }}>{l}</td>
      <td style={{ padding: "4px 0", fontWeight: 600, verticalAlign: "top" }}>{value}</td>
    </tr>
  );
}

/**
 * A printable credit note, in the same letterhead and layout as the invoice sheet (components/jobs/JobPrintSheet.tsx).
 * Uses the same `job-print-sheet` class, so `@media print` shows exactly this sheet. Every field comes from saved
 * records; a credit note is only created when the customer's billing details are complete.
 */
export default function CreditNoteSheet({ print }: { print: CreditNotePrint | null }) {
  if (!print) return null;
  const { invoice: inv } = print;
  const cn = inv.credits.find(c => c.number === print.creditNumber);
  if (!cn) return null;
  const cust = customerByName(inv.customer);
  return (
    <div className="job-print-sheet" style={{ color: "#111", fontFamily: "Arial, Helvetica, sans-serif", fontSize: 12, lineHeight: 1.45 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #111", paddingBottom: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>ServiceOps</div>
          <div style={{ fontSize: 11, color: "#555" }}>Field Service Management</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>CREDIT NOTE</div>
          <div style={{ fontSize: 11, color: "#555" }}>{cn.number} · against {inv.number}</div>
          <div style={{ fontSize: 10, color: "#777" }}>Printed {fmtDate(Date.now())}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 28, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={label}>Credit to</div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{inv.customer}</div>
          <div style={{ color: "#444" }}>{cust ? `${cust.street}, ${cust.cityLine}` : ""}</div>
          <div style={{ color: "#444" }}>{cust?.phone} · {cust?.email}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={label}>Reference</div>
          <table style={{ borderCollapse: "collapse", width: "100%" }}><tbody>
            <Row label="Credit note #" value={cn.number} />
            <Row label="Issued" value={fmtDate(cn.at)} />
            <Row label="Invoice" value={inv.number} />
            <Row label="Invoice issued" value={fmtDate(inv.issuedOn)} />
            {inv.woNumber && <Row label="Work order" value={inv.woNumber} />}
            <Row label="Job" value={inv.jobRef} />
          </tbody></table>
        </div>
      </div>

      <div style={label}>Credited</div>
      <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 10 }}>
        <thead><tr style={{ borderBottom: "1px solid #111" }}>
          <th style={{ textAlign: "left", padding: "4px 0" }}>Reason</th>
          <th style={{ textAlign: "right", padding: "4px 0", width: 110 }}>Amount</th>
        </tr></thead>
        <tbody><tr style={{ borderBottom: "1px solid #E5E5E5" }}>
          <td style={{ padding: "4px 0" }}>{cn.reason}</td>
          <td style={{ padding: "4px 0", textAlign: "right", fontWeight: 600 }}>{usd(cn.amount)}</td>
        </tr></tbody>
      </table>

      <table style={{ borderCollapse: "collapse", marginLeft: "auto", minWidth: 260 }}><tbody>
        <Row label="Invoice total" value={usd(inv.amount)} />
        <Row label="Payments received" value={usd(inv.paid)} />
        <Row label="All credit notes" value={usd(inv.credited)} />
        <tr style={{ borderTop: "1.5px solid #111" }}>
          <td style={{ padding: "6px 12px 0 0", fontWeight: 800 }}>This credit note</td>
          <td style={{ padding: "6px 0 0", fontWeight: 800, fontSize: 14 }}>{usd(cn.amount)}</td>
        </tr>
        <Row label="Balance now due" value={usd(inv.balance)} />
      </tbody></table>

      <div style={{ marginTop: 18, fontSize: 10, color: "#777", textAlign: "center" }}>
        This is a computer-generated credit note and does not require a physical stamp.
      </div>
    </div>
  );
}

"use client";
import Link from "next/link";
import Button from "@mui/material/Button";
import { Receipt, Printer } from "@phosphor-icons/react";
import { SideDrawer, DrawerSection, KV, Pill, MiniTable } from "@/components/ui/ServiceOpsUI";
import { INVOICE_TONE } from "@/components/workorders/woShared";
import { canManageMoney, usd } from "@/lib/ledger";
import { fmtDate, type Invoice } from "@/lib/serviceData";

/** One invoice in full: what is owed, every payment, credit notes, and void or reissue history. */
export default function InvoiceDrawer({ inv, role, onClose, onPay, onCredit, onVoid, onReissue, onPrintCredit, onOpenInvoice }: {
  inv: Invoice | undefined; role: string; onClose: () => void;
  onPay: (i: Invoice) => void; onCredit: (i: Invoice) => void; onVoid: (i: Invoice) => void; onReissue: (i: Invoice) => void;
  onPrintCredit: (i: Invoice, creditNumber: string) => void; onOpenInvoice: (number: string) => void;
}) {
  const manager = canManageMoney(role);
  const open = !!inv && inv.status !== "Void" && inv.balance > 0;
  return (
    <SideDrawer open={!!inv} onClose={onClose} icon={Receipt} title={inv ? inv.number : "Invoice"} subtitle={inv ? `${inv.customer} · ${inv.jobRef}` : undefined} width={600}
      footer={inv && (
        <>
          <Button disabled={!open} onClick={() => onPay(inv)} variant="contained" sx={{ textTransform: "none", fontWeight: 700 }}>Record payment</Button>
          <Button disabled={!open} onClick={() => onCredit(inv)} sx={{ textTransform: "none", fontWeight: 600 }}>Credit note</Button>
          {inv.status === "Void"
            ? <Button disabled={!manager || !!inv.reissuedAs} onClick={() => onReissue(inv)} sx={{ textTransform: "none", fontWeight: 600 }}>Reissue</Button>
            : <Button disabled={!manager || inv.status === "Draft"} onClick={() => onVoid(inv)} color="error" sx={{ textTransform: "none", fontWeight: 600 }}>Void</Button>}
        </>
      )}>
      {inv && (
        <>
          <DrawerSection title="Amounts">
            <KV label="Status"><Pill tone={INVOICE_TONE[inv.status]}>{inv.status}</Pill></KV>
            <KV label="Issued · due">{fmtDate(inv.issuedOn)} · {fmtDate(inv.dueOn)}</KV>
            {inv.stage && <KV label="Progress billing">{inv.stage.label}, stage {inv.stage.index + 1}</KV>}
            {inv.stage && inv.stage.adjustment !== 0 && <KV label="Adjusted for earlier stages">{inv.stage.adjustment > 0 ? "+" : ""}{usd(inv.stage.adjustment)} on a share of {usd(inv.stage.base)}</KV>}
            <KV label="Invoice total">{usd(inv.amount)}</KV>
            {inv.deposit > 0 && <KV label="Deposit already received">{usd(inv.deposit)}</KV>}
            <KV label="Payments received">{usd(inv.paid)}</KV>
            {inv.credited > 0 && <KV label="Credit notes">{usd(inv.credited)}</KV>}
            <KV label="Balance"><strong>{usd(inv.balance)}</strong></KV>
            {inv.heldCredit > 0 && <KV label="Customer credit held">{usd(inv.heldCredit)}</KV>}
            {inv.jobId && <KV label="Job"><Link href={`/jobs/${inv.jobId}`} className="text-blue-600 hover:underline">{inv.jobRef}</Link></KV>}
            {inv.reissueOf && <KV label="Replaces"><button type="button" className="text-blue-600 hover:underline" onClick={() => onOpenInvoice(inv.reissueOf!)}>{inv.reissueOf}</button></KV>}
          </DrawerSection>

          <DrawerSection title="Payments">
            {inv.payments.length === 0 ? <p className="m-0 text-body text-[var(--text-muted)]">No payments yet.</p> : (
              <MiniTable head={["Date", "Method", "Reference", "By", { label: "Amount", right: true }]} minWidth={520}>
                {inv.payments.map(p => (
                  <tr key={p.id}>
                    <td className="px-3 text-table-cell whitespace-nowrap">{fmtDate(p.at)}</td>
                    <td className="px-3 text-table-cell whitespace-nowrap">{p.kind === "deposit" ? "Deposit" : p.kind === "refund" ? "Refund" : p.kind === "transfer" ? "Credit moved" : p.method}</td>
                    <td className="px-3 text-table-cell">{p.reference || "—"}</td>
                    <td className="px-3 text-table-cell whitespace-nowrap">{p.recordedBy}</td>
                    <td className="px-3 text-right text-table-cell font-semibold whitespace-nowrap">{usd(p.amount)}</td>
                  </tr>
                ))}
              </MiniTable>
            )}
          </DrawerSection>

          {inv.credits.length > 0 && (
            <DrawerSection title="Credit notes">
              {inv.credits.map(c => (
                <div key={c.number} className="flex items-start justify-between gap-3 py-2 border-b border-[var(--border-soft)] last:border-b-0">
                  <div className="min-w-0"><p className="m-0 text-label font-semibold text-[var(--text-primary)]">{c.number} · {usd(c.amount)}</p><p className="m-0 text-caption text-[var(--text-muted)]">{fmtDate(c.at)} · {c.by} · {c.reason}</p></div>
                  <Button size="small" startIcon={<Printer size={14} />} onClick={() => onPrintCredit(inv, c.number)} sx={{ textTransform: "none" }}>Print</Button>
                </div>
              ))}
            </DrawerSection>
          )}

          {inv.void && (
            <DrawerSection title="Void">
              <KV label="Voided by">{inv.void.by} ({inv.void.role})</KV>
              <KV label="When">{fmtDate(inv.void.at)}</KV>
              <KV label="Reason">{inv.void.reason}</KV>
              <KV label="Money received">{inv.void.outcome === "none" ? "None had been received" : inv.void.outcome === "refund" ? "Refunded (see the refund entry above)" : "Kept as customer credit"}</KV>
              {inv.reissuedAs && <KV label="Reissued as"><button type="button" className="text-blue-600 hover:underline" onClick={() => onOpenInvoice(inv.reissuedAs!)}>{inv.reissuedAs}</button></KV>}
            </DrawerSection>
          )}
          {!manager && <p className="m-0 text-caption text-[var(--text-muted)]">Only a Service manager or Administrator can void or reissue an invoice.</p>}
        </>
      )}
    </SideDrawer>
  );
}

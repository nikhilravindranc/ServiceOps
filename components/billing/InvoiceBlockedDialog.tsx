"use client";
import Link from "next/link";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import { WarningCircle } from "@phosphor-icons/react";

export type InvoiceProblem = { text: string; fixHref?: string };

/** Shown instead of raising or sending an invoice that would have blank or wrong details. Lists exactly what to fix. */
export default function InvoiceBlockedDialog({ open, title, problems, onClose }: { open: boolean; title: string; problems: InvoiceProblem[]; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}><WarningCircle size={24} weight="fill" color="#D97706" />{title}</DialogTitle>
      <DialogContent>
        <p className="m-0 mb-3 text-body text-[var(--text-body)]">An invoice goes to the customer, so it is only created when every detail is in place. Fix these first:</p>
        <ul className="m-0 pl-5 flex flex-col gap-2">
          {problems.map((p, i) => (
            <li key={i} className="text-body text-[var(--text-primary)]">
              {p.text}{p.fixHref && <> <Link href={p.fixHref} className="font-semibold text-blue-600 hover:underline">Fix this</Link></>}
            </li>
          ))}
        </ul>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
}

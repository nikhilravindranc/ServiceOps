"use client";
import { authInput } from "@/components/auth/AuthCard";
import { TEST_CARDS } from "@/lib/payments";

export type CardState = { number: string; exp: string; cvc: string; name: string };
export const EMPTY_CARD: CardState = { number: "", exp: "", cvc: "", name: "" };

/** Card fields for the test processor, with the test numbers listed so people can try each outcome. */
export default function TestCardForm({ card, onChange }: { card: CardState; onChange: (c: CardState) => void }) {
  const set = (k: keyof CardState, v: string) => onChange({ ...card, [k]: v });
  return (
    <div className="space-y-3">
      <p className="m-0 px-3 py-2 rounded-xl text-[12.5px] font-medium text-amber-800" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
        Test mode: no card processor is connected, so nothing is charged. Use a test card:
        <span className="block mt-1 font-mono text-[12px]">
          {TEST_CARDS.map(c => (
            <button key={c.number} type="button" onClick={() => onChange({ number: c.number, exp: "12/34", cvc: "123", name: card.name || "Test Customer" })} className="block underline text-left">{c.number} · {c.outcome}</button>
          ))}
        </span>
      </p>
      <input className={authInput} inputMode="numeric" autoComplete="cc-number" placeholder="Card number" value={card.number} onChange={e => set("number", e.target.value)} aria-label="Card number" />
      <div className="grid grid-cols-2 gap-3">
        <input className={authInput} autoComplete="cc-exp" placeholder="MM/YY" value={card.exp} onChange={e => set("exp", e.target.value)} aria-label="Expiry" />
        <input className={authInput} inputMode="numeric" autoComplete="cc-csc" placeholder="CVC" value={card.cvc} onChange={e => set("cvc", e.target.value)} aria-label="Security code" />
      </div>
      <input className={authInput} autoComplete="cc-name" placeholder="Name on card" value={card.name} onChange={e => set("name", e.target.value)} aria-label="Name on card" />
    </div>
  );
}

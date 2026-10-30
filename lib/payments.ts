/**
 * Payment adapter. No card processor is connected, so this is a TEST processor that imitates Stripe's published test
 * cards. Nothing is charged and card numbers are never stored (only brand and last four digits). To go live, replace
 * `charge` with a call to the real processor; the pay and approve pages already send the card details through it.
 */
export type Card = { number: string; exp: string; cvc: string; name: string };
export type ChargeResult = { ok: true; ref: string; last4: string; brand: string } | { ok: false; error: string };

export const TEST_CARDS: { number: string; outcome: string }[] = [
  { number: "4242 4242 4242 4242", outcome: "Succeeds" },
  { number: "4000 0000 0000 0002", outcome: "Declined" },
  { number: "4000 0000 0000 9995", outcome: "Insufficient funds" },
  { number: "4000 0000 0000 0069", outcome: "Expired card" },
  { number: "4000 0000 0000 0127", outcome: "Incorrect CVC" },
];

const luhn = (n: string) => {
  let sum = 0, dbl = false;
  for (let i = n.length - 1; i >= 0; i--) { let d = Number(n[i]); if (dbl) { d *= 2; if (d > 9) d -= 9; } sum += d; dbl = !dbl; }
  return sum % 10 === 0;
};

export function charge(card: Card, amount: number): ChargeResult {
  const num = card.number.replace(/\s|-/g, "");
  if (!/^\d{13,19}$/.test(num) || !luhn(num)) return { ok: false, error: "That card number is not valid." };
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(card.exp.trim());
  if (!m) return { ok: false, error: "Enter the expiry as MM/YY." };
  const month = Number(m[1]), year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return { ok: false, error: "Enter the expiry as MM/YY." };
  if (year < new Date().getFullYear() || (year === new Date().getFullYear() && month < new Date().getMonth() + 1)) return { ok: false, error: "Your card has expired." };
  if (!/^\d{3,4}$/.test(card.cvc.trim())) return { ok: false, error: "Enter the 3 or 4 digit security code." };
  if (card.name.trim().length < 2) return { ok: false, error: "Enter the name on the card." };
  if (!(amount > 0)) return { ok: false, error: "Nothing to pay." };

  if (!TEST_CARDS.some(c => c.number.replace(/\s/g, "") === num)) return { ok: false, error: "Test mode: use one of the test card numbers shown on this page." };
  if (num === "4000000000000002") return { ok: false, error: "Your card was declined." };
  if (num === "4000000000009995") return { ok: false, error: "Your card has insufficient funds." };
  if (num === "4000000000000069") return { ok: false, error: "Your card has expired." };
  if (num === "4000000000000127") return { ok: false, error: "Your card's security code is incorrect." };
  return { ok: true, ref: `pi_test_${Math.random().toString(36).slice(2, 12)}`, last4: num.slice(-4), brand: "Visa" };
}

import { describe, expect, it } from "vitest";
import { auditMeta, diffRecords, summarise } from "@/lib/auditDiff";

describe("audit diff", () => {
  it("lists only the fields that changed, with before and after", () => {
    const d = diffRecords(JSON.stringify({ status: "Draft", amount: 100, note: "a" }), JSON.stringify({ status: "Sent", amount: 100, note: "a" }));
    expect(d.changed).toEqual(["status"]);
    expect(d.before).toEqual({ status: "Draft" });
    expect(d.after).toEqual({ status: "Sent" });
  });
  it("ignores the activity trail and other noisy fields", () => {
    const d = diffRecords(JSON.stringify({ a: 1, activity: [] }), JSON.stringify({ a: 1, activity: [{ label: "x" }] }));
    expect(d.changed).toEqual([]);
  });
  it("records a new record as all-new fields and a deleted one as all-removed", () => {
    expect(diffRecords(null, JSON.stringify({ a: 1 })).changed).toEqual(["a"]);
    expect(diffRecords(JSON.stringify({ a: 1 }), null).changed).toEqual(["a"]);
  });
  it("never stores embedded files, and cuts long text", () => {
    expect(summarise("data:image/png;base64,AAAA")).toBe("[file]");
    expect((summarise("x".repeat(500)) as string).length).toBeLessThan(260);
    const d = diffRecords(JSON.stringify({ signature: null }), JSON.stringify({ signature: { name: "A", dataUrl: "data:image/png;base64,ZZZZ" } }));
    expect(JSON.stringify(d.after)).not.toContain("ZZZZ");
  });
  it("keeps the stored text within its limit", () => {
    const big = { changed: ["a"], before: { a: "x".repeat(5000) }, after: { a: "y" } };
    expect(auditMeta(big).length).toBeLessThanOrEqual(4000);
    expect(JSON.parse(auditMeta(big)).changed).toEqual(["a"]);
  });
  it("tolerates broken JSON", () => {
    expect(diffRecords("not json", JSON.stringify({ a: 1 })).changed).toEqual(["a"]);
  });
});

import { describe, expect, it } from "vitest";
import { WORK_TYPES, detailPairs, missingDetails, parseDetails } from "@/lib/workTypes";

describe("work types", () => {
  it("has the five types with at least one required question each", () => {
    expect(WORK_TYPES).toEqual(["Installation", "Service", "Maintenance", "Repair", "Inspection"]);
    for (const t of WORK_TYPES) expect(missingDetails(t, {}).length).toBeGreaterThan(0);
  });
  it("reports exactly the missing required answers", () => {
    expect(missingDetails("Repair", { equipment: "RTU-3", fault: "warm air", equipmentDown: "Yes, completely", warranty: "No" })).toEqual([]);
    expect(missingDetails("Repair", { equipment: "RTU-3", fault: "  " })).toEqual(["What is wrong?", "Is the equipment out of action?", "Under warranty?"]);
  });
  it("shows only answered fields, in order", () => {
    expect(detailPairs("Inspection", { equipment: "Lift 2", inspectionKind: "Safety", certificate: "" })).toEqual([["What is being inspected", "Lift 2"], ["Inspection type", "Safety"]]);
  });
  it("survives bad stored details", () => {
    expect(parseDetails("nope")).toEqual({});
    expect(parseDetails(null)).toEqual({});
    expect(parseDetails('{"a":"b"}')).toEqual({ a: "b" });
  });
});

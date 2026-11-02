import { describe, expect, it } from "vitest";
import { canOpen } from "@/lib/access";

describe("who may open which screen", () => {
  it("lets administrators open everything", () => {
    for (const p of ["/", "/billing", "/users", "/settings", "/integrations", "/insights", "/tech"]) expect(canOpen("Administrator", p)).toBe(true);
  });
  it("keeps technicians to their own screens", () => {
    for (const p of ["/", "/tech", "/tech/12", "/jobs", "/work-orders", "/assets", "/timesheets", "/inventory"]) expect(canOpen("Technician", p)).toBe(true);
    for (const p of ["/billing", "/users", "/settings", "/requests", "/requests/new", "/customers", "/dispatch", "/insights", "/reports", "/catalog", "/plans", "/integrations"]) {
      expect(canOpen("Technician", p), p).toBe(false);
    }
  });
  it("keeps money screens away from dispatchers", () => {
    expect(canOpen("Dispatcher", "/billing")).toBe(false);
    expect(canOpen("Dispatcher", "/dispatch")).toBe(true);
  });
  it("lets coordinators bill but not dispatch or administer", () => {
    expect(canOpen("Service coordinator", "/billing")).toBe(true);
    expect(canOpen("Service coordinator", "/dispatch")).toBe(false);
    expect(canOpen("Service coordinator", "/users")).toBe(false);
  });
  it("only lets administrators open users and integrations", () => {
    for (const role of ["Service manager", "Dispatcher", "Service coordinator", "Technician"]) {
      expect(canOpen(role, "/users")).toBe(false);
      expect(canOpen(role, "/integrations")).toBe(false);
    }
  });
  it("denies unknown roles and missing roles", () => {
    expect(canOpen(undefined, "/")).toBe(false);
    expect(canOpen("Visitor", "/billing")).toBe(false);
  });
  it("matches sub-paths but not look-alike prefixes", () => {
    expect(canOpen("Technician", "/requests/REQ-1001")).toBe(false);
    expect(canOpen("Technician", "/billing-notes")).toBe(true); // not the /billing screen
  });
});

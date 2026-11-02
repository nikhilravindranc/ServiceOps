import { describe, expect, it } from "vitest";
import { canOpen } from "@/lib/access";

describe("test setup", () => {
  it("runs and resolves the @ alias", () => {
    expect(canOpen("Administrator", "/billing")).toBe(true);
  });
});

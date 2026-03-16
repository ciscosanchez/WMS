import { diffChanges } from "@/lib/audit";

describe("Audit utilities", () => {
  describe("diffChanges", () => {
    it("detects changed fields", () => {
      const old = { name: "Acme", code: "ACME", city: "Houston" };
      const updates = { name: "Acme Corp", code: "ACME", city: "Houston" };
      const diff = diffChanges(old, updates);
      expect(diff).toEqual({ name: { old: "Acme", new: "Acme Corp" } });
    });

    it("returns null when nothing changed", () => {
      const old = { name: "Acme", code: "ACME" };
      const updates = { name: "Acme", code: "ACME" };
      const diff = diffChanges(old, updates);
      expect(diff).toBeNull();
    });

    it("detects multiple changes", () => {
      const old = { name: "Acme", city: "Houston", state: "TX" };
      const updates = { name: "Acme Corp", city: "Dallas", state: "TX" };
      const diff = diffChanges(old, updates);
      expect(diff).toEqual({
        name: { old: "Acme", new: "Acme Corp" },
        city: { old: "Houston", new: "Dallas" },
      });
    });

    it("detects null to value changes", () => {
      const old = { name: "Acme", email: null };
      const updates = { name: "Acme", email: "test@acme.com" };
      const diff = diffChanges(old as any, updates as any);
      expect(diff).toEqual({ email: { old: null, new: "test@acme.com" } });
    });
  });
});

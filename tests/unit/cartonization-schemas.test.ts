import { cartonTypeSchemaStatic as cartonTypeSchema } from "@/modules/cartonization/schemas";

describe("cartonTypeSchema", () => {
  it("normalizes carton code and accepts supported units", () => {
    const result = cartonTypeSchema.safeParse({
      code: " sm_box ",
      name: "Small Box",
      length: 12,
      width: 10,
      height: 6,
      dimUnit: "in",
      maxWeight: 30,
      weightUnit: "lb",
      tareWeight: 1,
      cost: 0.5,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.code).toBe("SM_BOX");
  });

  it("rejects unsupported dimension units", () => {
    const result = cartonTypeSchema.safeParse({
      code: "BOX",
      name: "Box",
      length: 12,
      width: 10,
      height: 6,
      dimUnit: "ft",
      maxWeight: 30,
      weightUnit: "lb",
      tareWeight: 1,
    });

    expect(result.success).toBe(false);
  });
});

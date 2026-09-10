import { describe, expect, it } from "vitest";
import { canMarkOrderPaid } from "../services/fulfilment";

describe("paid-order fulfilment eligibility", () => {
  it("applies a payment while the order still holds its seats, even past the advertised deadline", () => {
    expect(canMarkOrderPaid("pending")).toBe(true);
    expect(canMarkOrderPaid("processing")).toBe(true);
  });
  it("refuses once the hold was released or the order already settled", () => {
    for (const status of ["expired", "failed", "paid", "free", "refunded", "partially_refunded"]) expect(canMarkOrderPaid(status), status).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { moneyText, paidOrders } from "./admin-format";

const m = (net: number, paid: number, refunded = 0) => ({ gross: net + refunded, refunded, net, platformFee: Math.round(net * 0.0099), paidOrders: paid });

describe("admin money text", () => {
  it("joins currencies in a stable order", () => {
    expect(moneyText({ USD: m(1000, 1), BRL: m(2500, 2) }, "net", "en-US", "—")).toBe("R$25.00 + $10.00");
  });
  it("shows zero for a fully refunded sale and the placeholder only when nothing sold", () => {
    expect(moneyText({ USD: m(0, 1, 1364) }, "net", "en-US", "—")).toBe("$0.00");
    expect(moneyText({ USD: m(0, 1, 1364) }, "refunded", "en-US", "—")).toBe("$13.64");
    expect(moneyText({}, "net", "en-US", "—")).toBe("—");
  });
  it("counts paid orders across currencies", () => {
    expect(paidOrders({ USD: m(1, 3), EUR: m(1, 4) })).toBe(7);
  });
});

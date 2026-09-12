import { describe, expect, it } from "vitest";
import { LOCALES, dirFor, isLocale, negotiateLocale } from "./locales";

describe("locales", () => {
  it("ships twenty languages with unique codes and two right-to-left scripts", () => {
    expect(LOCALES).toHaveLength(20);
    expect(new Set(LOCALES.map((l) => l.code)).size).toBe(20);
    expect(LOCALES.filter((l) => l.dir === "rtl").map((l) => l.code)).toEqual(["ar", "ur"]);
    expect(dirFor("ar")).toBe("rtl");
    expect(dirFor("en")).toBe("ltr");
  });

  it("negotiates from Accept-Language by exact tag, then language, in preference order", () => {
    expect(negotiateLocale("pt-BR,pt;q=0.9,en;q=0.8")).toBe("pt-BR");
    expect(negotiateLocale("pt-PT,en;q=0.5")).toBe("pt-BR");
    expect(negotiateLocale("zh-TW")).toBe("zh-CN");
    expect(negotiateLocale("fr-CA;q=0.6, de;q=0.9")).toBe("de");
    expect(negotiateLocale("xx-YY, *")).toBe("en");
    expect(negotiateLocale(null)).toBe("en");
    expect(negotiateLocale("AR")).toBe("ar");
  });

  it("recognises supported codes only", () => {
    expect(isLocale("ur")).toBe(true);
    expect(isLocale("pt")).toBe(false);
    expect(isLocale(42)).toBe(false);
  });
});

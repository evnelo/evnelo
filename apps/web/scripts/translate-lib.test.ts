import { describe, expect, it } from "vitest";
import { flatten, protectMessage, restoreMessage, unflatten } from "./translate-lib";

/** A stand-in for Google: upper-cases the translatable text and leaves notranslate spans alone. */
function fakeTranslate(html: string) {
  return html.split(/(<span class="notranslate">__\d+__<\/span>)/).map((part, i) => (i % 2 ? part : part.toUpperCase())).join("");
}
const roundTrip = (msg: string) => { const p = protectMessage(msg); return restoreMessage(fakeTranslate(p.text), p.tokens); };

describe("translation protection", () => {
  it("keeps simple arguments and rich-text tags intact", () => {
    expect(roundTrip("Hi {name}, welcome to <b>{event}</b>!")).toBe("HI {name}, WELCOME TO <b>{event}</b>!");
    expect(roundTrip("Brought to you by <inevent>InEvent</inevent>.")).toBe("BROUGHT TO YOU BY <inevent>INEVENT</inevent>.");
  });

  it("translates only the branch text of plurals and selects", () => {
    expect(roundTrip("{count, plural, one {# ticket left} other {# tickets left}}")).toBe("{count, plural, one {# TICKET LEFT} other {# TICKETS LEFT}}");
    expect(roundTrip("{gender, select, female {She replied} other {They replied}} to {name}")).toBe("{gender, select, female {SHE REPLIED} other {THEY REPLIED}} TO {name}");
  });

  it("decodes the entities Google returns in html mode", () => {
    expect(restoreMessage("Don&#39;t &amp; won&apos;t", [])).toBe("Don't & won't");
  });

  it("flattens and rebuilds nested messages in source order", () => {
    const en = { a: { b: "1", c: "2" }, d: "3" };
    const flat = flatten(en);
    expect(flat).toEqual({ "a.b": "1", "a.c": "2", d: "3" });
    expect(unflatten({ d: "x", "a.c": "y", "a.b": "z" }, flat)).toEqual({ a: { b: "z", c: "y" }, d: "x" });
  });
});

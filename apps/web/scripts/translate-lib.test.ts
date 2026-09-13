import { describe, expect, it } from "vitest";
import { flatten, isFaithful, planMessage, unflatten } from "./translate-lib";

/** A stand-in for the translation engine: upper-cases words, leaves notranslate spans alone. */
const fake = (html: string) => html.split(/(<span class="notranslate">__\d+__<\/span>)/).map((part, i) => (i % 2 ? part : part.toUpperCase())).join("");
const roundTrip = (msg: string) => { const p = planMessage(msg); return p.rebuild(p.texts.map(fake)); };

describe("message planning", () => {
  it("keeps arguments and rich-text tags intact", () => {
    expect(roundTrip("Hi {name}, welcome to <b>{event}</b>!")).toBe("HI {name}, WELCOME TO <B>{event}</B>!");
    expect(roundTrip("Brought to you by <inevent>InEvent</inevent>.")).toBe("BROUGHT TO YOU BY <INEVENT>INEVENT</INEVENT>.");
  });

  it("never sends the plural frame to the translator", () => {
    const p = planMessage("{count, plural, one {# ticket for {event}} other {# tickets for {event}}}");
    expect(p.texts.every((t) => !t.includes("plural"))).toBe(true);
    expect(p.texts).toHaveLength(2);
    expect(roundTrip("{count, plural, one {# ticket for {event}} other {# tickets for {event}}}"))
      .toBe("{count, plural, one {# TICKET FOR {event}} other {# TICKETS FOR {event}}}");
  });

  it("survives a reordering translator, the way right-to-left languages need", () => {
    const p = planMessage("{count, plural, one {Here is your ticket for <link>{event}</link>} other {Here are your tickets}}");
    // reverse the pieces of each run, as a different word order would
    const out = p.rebuild(p.texts.map((t) => t.split(/(<span class="notranslate">__\d+__<\/span>)/).reverse().join("")));
    expect(out.startsWith("{count, plural, one {")).toBe(true);
    expect(out.endsWith("}}")).toBe(true);
    expect((out.match(/\{/g) ?? []).length).toBe((out.match(/\}/g) ?? []).length);
    expect(out).toContain("{event}");
  });

  it("skips runs that are only placeholders or punctuation", () => {
    expect(planMessage("{name}").texts).toEqual([]);
    expect(roundTrip("{name}")).toBe("{name}");
    expect(roundTrip("{a} — {b}")).toBe("{a} — {b}");
  });

  it("handles nested selects inside plurals", () => {
    const msg = "{count, plural, one {{gender, select, female {She came} other {They came}}} other {# came}}";
    const out = roundTrip(msg);
    expect(out).toBe("{count, plural, one {{gender, select, female {SHE CAME} other {THEY CAME}}} other {# CAME}}");
  });

  it("decodes the entities and padding the engine returns in html mode", () => {
    const p = planMessage("Don't stop {name}");
    expect(p.rebuild(["Don&#39;t  stop  <span class=\"notranslate\">__0__</span> "])).toBe("Don't stop {name}");
  });

  it("flattens and rebuilds nested messages in source order", () => {
    const en = { a: { b: "1", c: "2" }, d: "3" };
    const flat = flatten(en);
    expect(flat).toEqual({ "a.b": "1", "a.c": "2", d: "3" });
    expect(unflatten({ d: "x", "a.c": "y", "a.b": "z" }, flat)).toEqual({ a: { b: "z", c: "y" }, d: "x" });
  });
});

describe("faithfulness", () => {
  it("accepts a translation that keeps the structure and arguments", () => {
    expect(isFaithful("Hi {name}", "Olá {name}")).toBe(true);
    expect(isFaithful("{count, plural, one {# ticket} other {# tickets}}", "{count, plural, one {# تذكرة} other {# تذاكر}}")).toBe(true);
  });

  it("rejects unbalanced tags, dropped arguments and broken plural frames", () => {
    expect(isFaithful("<b>0.99%</b> free.<br></br> done", "<b></b> 0.99%</br> مجاني. <br>تم")).toBe(false);
    expect(isFaithful("Hi {name}", "Olá")).toBe(false);
    expect(isFaithful("{count, plural, one {#} other {#}}", "{count, plural,}} #")).toBe(false);
  });
});

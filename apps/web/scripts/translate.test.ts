import { describe, expect, it } from "vitest";
import { applyGlossary } from "./translate";

const glossary = { ru: [["событи", "мероприяти"]] as [string, string][], "zh-CN": [["事件", "活动"]] as [string, string][] };

describe("glossary", () => {
  it("fixes the word the engine keeps getting wrong, in every inflection", () => {
    expect(applyGlossary(glossary, "ru", "Your events", "Ваши события")).toBe("Ваши мероприятия");
    expect(applyGlossary(glossary, "ru", "No events", "Нет событий")).toBe("Нет мероприятий");
    expect(applyGlossary(glossary, "zh-CN", "Upcoming events", "即将举行的事件")).toBe("即将举行的活动");
  });

  it("leaves the computing sense alone where English means a webhook event", () => {
    expect(applyGlossary(glossary, "ru", "Pick the webhook events to send", "Выберите события")).toBe("Выберите события");
  });

  it("does nothing for a locale with no entries", () => {
    expect(applyGlossary(glossary, "fr", "Your events", "Vos événements")).toBe("Vos événements");
  });
});

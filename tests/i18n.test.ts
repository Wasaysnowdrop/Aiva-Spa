import { describe, expect, it } from "vitest"

import {
  SUPPORTED_LANGUAGES,
  buildLanguageDirective,
  fillTemplate,
  getDictionary,
  isRtlLanguage,
  isSupportedLanguage,
  makeTranslator,
  parseAcceptLanguage,
  resolveWidgetLanguage,
} from "@/lib/i18n"

describe("i18n — parseAcceptLanguage", () => {
  it("returns null for empty input", () => {
    expect(parseAcceptLanguage(null)).toBeNull()
    expect(parseAcceptLanguage("")).toBeNull()
  })

  it("picks the first supported tag", () => {
    expect(parseAcceptLanguage("en-US,en;q=0.9,fr;q=0.5")).toBe("en")
    expect(parseAcceptLanguage("fr-CA,fr;q=0.9")).toBe("fr")
    expect(parseAcceptLanguage("es-MX,es;q=0.9")).toBe("es")
  })

  it("ignores unsupported tags and falls through to the next", () => {
    expect(parseAcceptLanguage("xx-XX,fr-FR,en-US")).toBe("fr")
  })

  it("returns null when nothing matches", () => {
    expect(parseAcceptLanguage("xx,yy-ZZ")).toBeNull()
  })
})

describe("i18n — resolveWidgetLanguage", () => {
  it("prefers the explicit visitor override over everything else", () => {
    expect(
      resolveWidgetLanguage({
        visitorOverride: "es",
        urlParam: "fr",
        browserHeader: "de",
        ownerDefault: "it",
      }),
    ).toBe("es")
  })

  it("prefers URL param over browser", () => {
    expect(
      resolveWidgetLanguage({
        urlParam: "ja",
        browserHeader: "de",
        ownerDefault: "it",
      }),
    ).toBe("ja")
  })

  it("prefers browser over owner default", () => {
    expect(
      resolveWidgetLanguage({
        browserHeader: "pt-BR",
        ownerDefault: "fr",
      }),
    ).toBe("pt")
  })

  it("falls back to owner default when no signal exists", () => {
    expect(resolveWidgetLanguage({ ownerDefault: "de" })).toBe("de")
  })

  it("falls back to en when nothing matches", () => {
    expect(resolveWidgetLanguage({})).toBe("en")
    expect(resolveWidgetLanguage({ urlParam: "xx" })).toBe("en")
  })
})

describe("i18n — getDictionary", () => {
  it("returns the English dictionary for 'en'", () => {
    const d = getDictionary("en")
    expect(d["book_cta"]).toBe("Book a consult")
  })

  it("returns a translated dictionary for non-English codes", () => {
    const d = getDictionary("es")
    expect(d["book_cta"]).toBe("Reservar consulta")
  })

  it("falls back to English for unknown codes", () => {
    const d = getDictionary("xx" as never)
    expect(d["book_cta"]).toBe("Book a consult")
  })

  it("every supported language has all required keys", () => {
    const required = Object.keys(getDictionary("en"))
    for (const code of SUPPORTED_LANGUAGES) {
      const dict = getDictionary(code)
      for (const key of required) {
        expect(typeof dict[key as keyof typeof dict]).toBe("string")
        expect((dict[key as keyof typeof dict] as string).length).toBeGreaterThan(0)
      }
    }
  })
})

describe("i18n — fillTemplate / makeTranslator", () => {
  it("replaces {name} placeholders", () => {
    expect(fillTemplate("Hi {name}!", { name: "Sara" })).toBe("Hi Sara!")
  })

  it("leaves unknown variables as empty strings", () => {
    expect(fillTemplate("Hi {name} from {city}!", { name: "Sara" })).toBe(
      "Hi Sara from !",
    )
  })

  it("makeTranslator returns the right string for a key with vars", () => {
    const t = makeTranslator("en")
    expect(t("submit.send", { brand: "Glow" })).toBe("Send to Glow")
    expect(t("typing", { brand: "Glow" })).toBe("Glow is typing…")
  })
})

describe("i18n — RTL languages", () => {
  it("flags Arabic as RTL", () => {
    expect(isRtlLanguage("ar")).toBe(true)
  })

  it("treats all other supported languages as LTR", () => {
    for (const code of SUPPORTED_LANGUAGES) {
      if (code === "ar") continue
      expect(isRtlLanguage(code)).toBe(false)
    }
  })
})

describe("i18n — isSupportedLanguage", () => {
  it("accepts every SUPPORTED_LANGUAGES value", () => {
    for (const code of SUPPORTED_LANGUAGES) {
      expect(isSupportedLanguage(code)).toBe(true)
    }
  })

  it("rejects unknown values", () => {
    expect(isSupportedLanguage("xx")).toBe(false)
    expect(isSupportedLanguage(null)).toBe(false)
    expect(isSupportedLanguage(123)).toBe(false)
  })
})

describe("i18n — buildLanguageDirective", () => {
  it("returns the empty string for English", () => {
    expect(buildLanguageDirective("en")).toBe("")
  })

  it("includes the language name and an instruction to answer in that language", () => {
    const d = buildLanguageDirective("es")
    expect(d).toMatch(/Spanish|Espa/i)
    expect(d).toMatch(/reply in/i)
  })

  it("produces a different directive per language", () => {
    const es = buildLanguageDirective("es")
    const ja = buildLanguageDirective("ja")
    expect(es).not.toBe(ja)
  })
})

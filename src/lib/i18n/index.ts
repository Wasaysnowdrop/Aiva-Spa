import {
  getDictionary,
  isSupportedLanguage,
  SUPPORTED_LANGUAGES,
  type LanguageCode,
  type TranslationDictionary,
  type TranslationKey,
} from "./translations"

export type { LanguageCode, TranslationKey, TranslationDictionary }
export { SUPPORTED_LANGUAGES, getDictionary, isSupportedLanguage }

/**
 * Normalize a browser language string ("en-US", "fr-CA", "pt-BR", …) to
 * one of our supported language codes. Returns null when nothing matches.
 */
export function parseAcceptLanguage(header: string | null | undefined): LanguageCode | null {
  if (!header) return null
  const parts = header
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
  for (const part of parts) {
    const tag = part.split(";")[0]?.trim().toLowerCase()
    if (!tag) continue
    const base = tag.split("-")[0]
    if (isSupportedLanguage(base)) return base as LanguageCode
  }
  return null
}

/**
 * Pick the language the widget should use, given:
 *   - the optional explicit `?lang=xx` URL param
 *   - the owner's configured default
 *   - the visitor's browser language
 *
 * Resolution order: URL param > browser language > owner default > "en".
 * The owner's default is honored only when the visitor hasn't expressed
 * a preference, to avoid the chat suddenly flipping languages on repeat
 * visits to a multi-language site.
 */
export function resolveWidgetLanguage(input: {
  urlParam?: string | null
  browserHeader?: string | null
  ownerDefault?: string | null
  visitorOverride?: string | null
}): LanguageCode {
  const candidates: Array<string | null | undefined> = [
    input.visitorOverride,
    input.urlParam,
    parseAcceptLanguage(input.browserHeader),
    input.ownerDefault,
  ]
  for (const c of candidates) {
    if (isSupportedLanguage(c)) return c
  }
  return "en"
}

/**
 * Fill a template string with the given variables. Supports
 * `{name}` and falls back to an empty string when a variable is missing.
 */
export function fillTemplate(
  template: string,
  vars: Record<string, string | undefined>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = vars[key]
    return typeof v === "string" ? v : ""
  })
}

export type Translator = (key: TranslationKey, vars?: Record<string, string | undefined>) => string

export function makeTranslator(lang: LanguageCode): Translator {
  const dict = getDictionary(lang)
  return (key, vars) => fillTemplate(dict[key], vars ?? {})
}

export const RTL_LANGUAGES: ReadonlySet<LanguageCode> = new Set<LanguageCode>(["ar"])

export function isRtlLanguage(lang: LanguageCode): boolean {
  return RTL_LANGUAGES.has(lang)
}

/**
 * Build the system-prompt hint that tells the LLM which language to
 * answer in. Returns the empty string for English (which is the
 * implicit default) so the prompt stays clean.
 */
export function buildLanguageDirective(lang: LanguageCode): string {
  if (lang === "en") return ""
  const names: Record<LanguageCode, string> = {
    en: "English",
    es: "Spanish (Español)",
    fr: "French (Français)",
    de: "German (Deutsch)",
    it: "Italian (Italiano)",
    pt: "Portuguese (Português)",
    nl: "Dutch (Nederlands)",
    pl: "Polish (Polski)",
    tr: "Turkish (Türkçe)",
    ar: "Arabic (العربية)",
    zh: "Simplified Chinese (简体中文)",
    ja: "Japanese (日本語)",
  }
  return `\n\n# LANGUAGE OVERRIDE (highest priority)
The visitor's chat widget is set to ${names[lang]}. You MUST write every reply in ${names[lang]} for as long as this directive is in effect, even if the KB is in English. Preserve your human voice and the brand-voice rules above. Do not switch languages unless the visitor writes in a different language AND asks you to switch.`
}

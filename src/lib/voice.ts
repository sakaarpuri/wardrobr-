export type SupportedVoiceLocale = 'en-GB' | 'hi-IN'

const DEVANAGARI_REGEX = /[\u0900-\u097F]/

export function containsHindiScript(text?: string | null) {
  return Boolean(text && DEVANAGARI_REGEX.test(text))
}

export function resolveVoiceLocale({
  browserLanguages = [],
  hints = [],
}: {
  browserLanguages?: readonly string[]
  hints?: Array<string | null | undefined>
}): SupportedVoiceLocale {
  if (hints.some((hint) => containsHindiScript(hint))) {
    return 'hi-IN'
  }

  const normalizedLanguages = browserLanguages
    .filter(Boolean)
    .map((language) => language.toLowerCase())

  if (normalizedLanguages.some((language) => language.startsWith('hi'))) {
    return 'hi-IN'
  }

  if (normalizedLanguages.some((language) => language.startsWith('en-gb'))) {
    return 'en-GB'
  }

  return 'en-GB'
}

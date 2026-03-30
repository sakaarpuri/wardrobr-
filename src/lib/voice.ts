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

export function resolveSpeechLocale({
  browserLanguages = [],
  hints = [],
}: {
  browserLanguages?: readonly string[]
  hints?: Array<string | null | undefined>
}) {
  if (hints.some((hint) => containsHindiScript(hint))) {
    return 'hi-IN'
  }

  const normalizedLanguages = browserLanguages
    .filter(Boolean)
    .map((language) => language.toLowerCase())

  const supported = [
    'en-gb',
    'en-in',
    'en-us',
    'hi-in',
  ] as const

  for (const language of normalizedLanguages) {
    const exact = supported.find((value) => language.startsWith(value))
    if (exact) {
      return exact === 'hi-in' ? 'hi-IN' : exact === 'en-in' ? 'en-IN' : exact === 'en-us' ? 'en-US' : 'en-GB'
    }
  }

  if (normalizedLanguages.some((language) => language.startsWith('hi'))) {
    return 'hi-IN'
  }

  return 'en-GB'
}

export function resolveTtsVoice(locale: string) {
  if (locale === 'hi-IN') return 'Achird'
  if (locale === 'en-IN') return 'Achird'
  if (locale === 'en-US') return 'Puck'
  return 'Achird'
}

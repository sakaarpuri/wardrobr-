'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { containsHindiScript } from '@/lib/voice'

function pickVoice(text: string, voices: SpeechSynthesisVoice[]) {
  const browserLanguages = navigator.languages?.length ? navigator.languages : [navigator.language]
  const normalized = browserLanguages.filter(Boolean).map((lang) => lang.toLowerCase())
  const wantsHindi = containsHindiScript(text) || normalized.some((lang) => lang.startsWith('hi'))

  if (wantsHindi) {
    return voices.find((voice) => voice.lang.toLowerCase().startsWith('hi'))
      ?? voices.find((voice) => voice.lang.toLowerCase().includes('in'))
      ?? null
  }

  for (const lang of normalized) {
    const exact = voices.find((voice) => voice.lang.toLowerCase() === lang)
    if (exact) return exact
  }

  for (const lang of normalized) {
    const primary = lang.split('-')[0]
    const partial = voices.find((voice) => voice.lang.toLowerCase().startsWith(primary))
    if (partial) return partial
  }

  return voices.find((voice) => voice.default) ?? voices[0] ?? null
}

export function useAssistantSpeech() {
  const [isSupported] = useState(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window
  )
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return
    }

    const updateVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices()
    }

    updateVoices()
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices)

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', updateVoices)
      window.speechSynthesis.cancel()
    }
  }, [])

  const stop = useCallback(() => {
    if (!isSupported) return
    window.speechSynthesis.cancel()
  }, [isSupported])

  const speak = useCallback((text: string) => {
    const message = text.trim()
    if (!isSupported || !message) return

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(message)
    const voice = pickVoice(message, voicesRef.current)

    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    } else {
      utterance.lang = containsHindiScript(message) ? 'hi-IN' : (navigator.languages?.[0] || navigator.language || 'en-GB')
    }

    utterance.rate = 0.98
    utterance.pitch = 1
    utterance.volume = 1

    window.speechSynthesis.speak(utterance)
  }, [isSupported])

  return {
    isSupported,
    speak,
    stop,
  }
}

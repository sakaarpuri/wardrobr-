'use client'

import { useCallback, useRef } from 'react'
import { resolveSpeechLocale } from '@/lib/voice'

function base64ToArrayBuffer(base64: string) {
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

function pcmToAudioBuffer(
  context: AudioContext,
  pcmBuffer: ArrayBuffer,
  sampleRate = 24000
) {
  const pcmView = new DataView(pcmBuffer)
  const sampleCount = pcmBuffer.byteLength / 2
  const audioBuffer = context.createBuffer(1, sampleCount, sampleRate)
  const channelData = audioBuffer.getChannelData(0)

  for (let i = 0; i < sampleCount; i += 1) {
    const sample = pcmView.getInt16(i * 2, true)
    channelData[i] = sample / 0x8000
  }

  return audioBuffer
}

export function useAssistantSpeech() {
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const requestIdRef = useRef(0)
  const playbackResolveRef = useRef<(() => void) | null>(null)

  const stop = useCallback(() => {
    requestIdRef.current += 1
    playbackResolveRef.current?.()
    playbackResolveRef.current = null
    sourceRef.current?.stop()
    sourceRef.current?.disconnect()
    sourceRef.current = null
  }, [])

  const speak = useCallback(async (text: string) => {
    const message = text.trim()
    if (!message) return

    const currentRequest = requestIdRef.current + 1
    requestIdRef.current = currentRequest
    stop()

    const locale = resolveSpeechLocale({
      browserLanguages: navigator.languages?.length ? navigator.languages : [navigator.language],
      hints: [message],
    })

    const response = await fetch('/api/voice/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message, locale }),
    })

    if (!response.ok) {
      return
    }

    const payload = await response.json()
    const audioBase64 = String(payload.audioBase64 ?? '')
    if (!audioBase64 || requestIdRef.current !== currentRequest) {
      return
    }

    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext
    if (!AudioContextCtor) {
      return
    }

    const context = audioContextRef.current ?? new AudioContextCtor()
    audioContextRef.current = context
    if (context.state === 'suspended') {
      await context.resume()
    }

    const audioBuffer = pcmToAudioBuffer(context, base64ToArrayBuffer(audioBase64))
    const source = context.createBufferSource()
    source.buffer = audioBuffer
    source.connect(context.destination)
    const endedPromise = new Promise<void>((resolve) => {
      playbackResolveRef.current = resolve
      source.onended = () => {
        if (sourceRef.current === source) {
          sourceRef.current = null
        }
        if (playbackResolveRef.current === resolve) {
          playbackResolveRef.current = null
        }
        resolve()
      }
    })

    sourceRef.current = source
    source.start()
    await endedPromise
  }, [stop])

  return {
    isSupported: typeof window !== 'undefined' && Boolean(window.AudioContext ?? window.webkitAudioContext),
    speak,
    stop,
  }
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type VoiceCaptureState = 'idle' | 'listening' | 'processing' | 'error'

interface UseVoiceCaptureOptions {
  onTranscript: (transcript: string) => Promise<void> | void
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}

function mergeBuffers(chunks: Float32Array[]) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const merged = new Float32Array(length)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return merged
}

function floatTo16BitPCM(view: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i += 1, offset += 2) {
    const sample = Math.max(-1, Math.min(1, input[i]))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }
}

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i))
  }
}

function encodeWav(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, samples.length * 2, true)
  floatTo16BitPCM(view, 44, samples)

  return new Blob([view], { type: 'audio/wav' })
}

export function useVoiceCapture({ onTranscript }: UseVoiceCaptureOptions) {
  const [voiceState, setVoiceState] = useState<VoiceCaptureState>('idle')
  const [transcript, setTranscript] = useState('')
  const [isSupported, setIsSupported] = useState(true)

  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Float32Array[]>([])
  const sampleRateRef = useRef(16000)
  const shouldSubmitRef = useRef(true)
  const mountedRef = useRef(true)

  useEffect(() => {
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext
    const supported =
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      Boolean(AudioContextCtor)

    setIsSupported(supported)

    return () => {
      mountedRef.current = false
      void audioContextRef.current?.close()
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const reset = useCallback(() => {
    if (!mountedRef.current) return
    setVoiceState('idle')
    setTranscript('')
    chunksRef.current = []
  }, [])

  const transcribeAudio = useCallback(async (blob: Blob) => {
    const formData = new FormData()
    formData.append('audio', blob, 'voice-brief.wav')

    const response = await fetch('/api/voice/transcribe', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new Error(payload?.error ?? 'Voice transcription failed')
    }

    const payload = await response.json()
    return String(payload.transcript ?? '').trim()
  }, [])

  const teardownAudioGraph = useCallback(async () => {
    processorRef.current?.disconnect()
    sourceRef.current?.disconnect()
    gainRef.current?.disconnect()
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null
    sourceRef.current = null
    processorRef.current = null
    gainRef.current = null
    if (audioContextRef.current) {
      await audioContextRef.current.close()
      audioContextRef.current = null
    }
  }, [])

  const handleStop = useCallback(async () => {
    const merged = mergeBuffers(chunksRef.current)
    chunksRef.current = []
    await teardownAudioGraph()

    if (!shouldSubmitRef.current || merged.length === 0) {
      reset()
      return
    }

    if (!mountedRef.current) return
    setVoiceState('processing')

    try {
      const blob = encodeWav(merged, sampleRateRef.current)
      const nextTranscript = await transcribeAudio(blob)
      if (!nextTranscript) {
        throw new Error('I could not hear enough to transcribe that. Please try again.')
      }

      if (!mountedRef.current) return
      setTranscript(nextTranscript)
      await onTranscript(nextTranscript)
      reset()
    } catch (error) {
      if (!mountedRef.current) return
      setVoiceState('error')
      setTranscript(error instanceof Error ? error.message : 'Voice transcription failed')
    }
  }, [onTranscript, reset, teardownAudioGraph, transcribeAudio])

  const startListening = useCallback(async () => {
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext
    if (!navigator.mediaDevices?.getUserMedia || !AudioContextCtor) {
      setIsSupported(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const audioContext = new AudioContextCtor()
      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      const gain = audioContext.createGain()

      gain.gain.value = 0

      mediaStreamRef.current = stream
      audioContextRef.current = audioContext
      sourceRef.current = source
      processorRef.current = processor
      gainRef.current = gain
      chunksRef.current = []
      shouldSubmitRef.current = true
      sampleRateRef.current = audioContext.sampleRate
      setTranscript('')
      setVoiceState('listening')

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0)
        chunksRef.current.push(new Float32Array(input))
      }

      source.connect(processor)
      processor.connect(gain)
      gain.connect(audioContext.destination)
    } catch {
      setVoiceState('error')
    }
  }, [])

  const stopListening = useCallback(() => {
    if (voiceState !== 'listening') return
    void handleStop()
  }, [handleStop, voiceState])

  const cancelListening = useCallback(() => {
    shouldSubmitRef.current = false
    void teardownAudioGraph()
    reset()
  }, [reset, teardownAudioGraph])

  return {
    voiceState,
    transcript,
    isSupported,
    startListening,
    stopListening,
    cancelListening,
    reset,
  }
}

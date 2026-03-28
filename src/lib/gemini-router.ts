import { classifyIntent, classifyImage, IntentType, ImageMetadata } from './gemini-lite'

export interface RouteResult {
  intentType: IntentType
  imageMetadata?: ImageMetadata
  /** Hint injected into the Flash prompt when an image is present */
  imageContextHint?: string
}

/**
 * Route a request using Flash-Lite pre-classification before invoking the full Flash model.
 *
 * - Text only: classifies intent (cheap, ~1 RTT to Flash-Lite)
 * - Image present: classifies image metadata in parallel with intent classification
 * - Both run concurrently via Promise.all to avoid adding latency
 *
 * Cost impact: each Flash-Lite call costs ~$0.25/1M tokens vs $0.50/1M for Flash.
 * For image uploads, the pre-classification is especially valuable because it
 * avoids sending the full image to Flash twice.
 */
export async function routeRequest(params: {
  userInput?: string
  imageBase64?: string
  imageMimeType?: string
}): Promise<RouteResult> {
  const { userInput, imageBase64, imageMimeType } = params

  let intentType: IntentType = 'outfit_request'
  let imageMetadata: ImageMetadata | undefined

  const tasks: Promise<void>[] = []

  if (userInput?.trim()) {
    tasks.push(
      classifyIntent(userInput).then((result) => {
        intentType = result.type
        console.log(`[router] intent=${result.type} confidence=${result.confidence} model=gemini-3.1-flash-lite`)
      })
    )
  }

  if (imageBase64) {
    tasks.push(
      classifyImage(imageBase64, imageMimeType).then((meta) => {
        imageMetadata = meta
        console.log(
          `[router] image colours=${meta.colours.join(',')} formality=${meta.formality} model=gemini-3.1-flash-lite`
        )
      })
    )
  }

  await Promise.all(tasks)

  // Build a context hint for Flash so it doesn't need to re-derive what Lite already extracted
  let imageContextHint: string | undefined
  if (imageMetadata) {
    const parts: string[] = []
    if (imageMetadata.colours.length) parts.push(`Dominant colours: ${imageMetadata.colours.join(', ')}`)
    if (imageMetadata.categories.length) parts.push(`Visible categories: ${imageMetadata.categories.join(', ')}`)
    if (imageMetadata.gender) parts.push(`Gender: ${imageMetadata.gender}`)
    if (imageMetadata.formality) parts.push(`Formality: ${imageMetadata.formality}`)
    if (parts.length) imageContextHint = `[Pre-classified] ${parts.join(' · ')}`
  }

  return { intentType, imageMetadata, imageContextHint }
}

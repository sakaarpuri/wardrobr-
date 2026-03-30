import type { Product } from './types'
import { extractSpecificItemCategories } from './shopper'

export type MaterialPreference = 'genuine_leather' | 'faux_leather' | 'suede' | null
export type FinishPreference = 'matte' | 'shiny' | 'patent' | null

export interface ProtectedProductAttributes {
  category: string | null
  material: MaterialPreference
  finish: FinishPreference
}

function cleanText(value?: string | null) {
  return value?.trim().toLowerCase() ?? ''
}

export function getEmptyProtectedProductAttributes(): ProtectedProductAttributes {
  return {
    category: null,
    material: null,
    finish: null,
  }
}

export function extractProtectedAttributesFromText(text?: string | null): ProtectedProductAttributes {
  const source = cleanText(text)
  const categories = extractSpecificItemCategories(source)

  let material: MaterialPreference = null
  if (/(faux leather|vegan leather|pleather|pu leather|synthetic leather|imitation leather)/.test(source)) {
    material = 'faux_leather'
  } else if (/\bsuede\b/.test(source)) {
    material = 'suede'
  } else if (/\bleather\b/.test(source)) {
    material = 'genuine_leather'
  }

  let finish: FinishPreference = null
  if (/\bpatent\b/.test(source)) {
    finish = 'patent'
  } else if (/(less shiny|not shiny|matte|matt|low sheen|without shine|de-shine|less glossy)/.test(source)) {
    finish = 'matte'
  } else if (/(shiny|glossy|high sheen|high shine|gloss)/.test(source)) {
    finish = 'shiny'
  }

  return {
    category: categories[0] ?? null,
    material,
    finish,
  }
}

export function extractProtectedAttributesFromProduct(product?: Pick<Product, 'name' | 'description' | 'category'> | null): ProtectedProductAttributes {
  if (!product) {
    return getEmptyProtectedProductAttributes()
  }

  const derived = extractProtectedAttributesFromText([product.name, product.description, product.category].filter(Boolean).join(' '))

  return {
    ...derived,
    category: product.category ?? derived.category,
  }
}

export function mergeProtectedAttributes(
  ...sources: Array<ProtectedProductAttributes | null | undefined>
): ProtectedProductAttributes {
  return sources.reduce<ProtectedProductAttributes>(
    (merged, current) => ({
      category: merged.category ?? current?.category ?? null,
      material: merged.material ?? current?.material ?? null,
      finish: merged.finish ?? current?.finish ?? null,
    }),
    getEmptyProtectedProductAttributes()
  )
}

export function hasProtectedAttributes(attributes: ProtectedProductAttributes) {
  return Boolean(attributes.category || attributes.material || attributes.finish)
}

export function buildProtectedSearchQuery(query: string, attributes: ProtectedProductAttributes) {
  const lowered = cleanText(query)
  const additions: string[] = []

  if (attributes.material === 'faux_leather' && !/(faux leather|vegan leather|pleather|pu leather)/.test(lowered)) {
    additions.push('faux leather')
  } else if (attributes.material === 'genuine_leather' && !/\bgenuine leather\b/.test(lowered)) {
    additions.push('genuine leather')
  } else if (attributes.material === 'suede' && !/\bsuede\b/.test(lowered)) {
    additions.push('suede')
  }

  if (attributes.finish === 'matte' && !/\bmatte\b/.test(lowered)) {
    additions.push('matte')
  } else if (attributes.finish === 'patent' && !/\bpatent\b/.test(lowered)) {
    additions.push('patent')
  } else if (attributes.finish === 'shiny' && !/\bshiny\b/.test(lowered)) {
    additions.push('shiny')
  }

  return [query.trim(), ...additions].filter(Boolean).join(' ').trim()
}

function materialMatches(text: string, material: MaterialPreference) {
  if (!material) return true

  if (material === 'faux_leather') {
    return /(faux leather|vegan leather|pleather|pu leather|synthetic leather|imitation leather)/.test(text)
  }

  if (material === 'suede') {
    return /\bsuede\b/.test(text)
  }

  if (material === 'genuine_leather') {
    if (/(faux leather|vegan leather|pleather|pu leather|synthetic leather|imitation leather)/.test(text)) {
      return false
    }
    return /\bleather\b/.test(text)
  }

  return true
}

function finishMatches(text: string, finish: FinishPreference) {
  if (!finish) return true

  if (finish === 'matte') {
    return /(matte|matt|low sheen|soft grain|grain leather|less shine)/.test(text) || !/(patent|glossy|shiny|high shine)/.test(text)
  }

  if (finish === 'patent') {
    return /\bpatent\b/.test(text)
  }

  if (finish === 'shiny') {
    return /(shiny|glossy|high shine|patent)/.test(text)
  }

  return true
}

export function matchesProtectedAttributes(product: Product, attributes: ProtectedProductAttributes) {
  const haystack = cleanText([product.name, product.description, product.category].filter(Boolean).join(' '))

  return materialMatches(haystack, attributes.material) && finishMatches(haystack, attributes.finish)
}

export function constrainProductsToProtectedAttributes(
  products: Product[],
  attributes: ProtectedProductAttributes
) {
  if (!hasProtectedAttributes(attributes)) {
    return {
      products,
      disclosure: null as string | null,
    }
  }

  const strictMatches = products.filter((product) => matchesProtectedAttributes(product, attributes))
  if (strictMatches.length > 0) {
    return {
      products: strictMatches,
      disclosure: null as string | null,
    }
  }

  return {
    products,
    disclosure: buildProtectedDisclosure(attributes, products[0] ?? null),
  }
}

export function buildProtectedDisclosure(
  requested: ProtectedProductAttributes,
  fallbackProduct?: Pick<Product, 'name' | 'description' | 'category'> | null
) {
  const fallback = extractProtectedAttributesFromProduct(fallbackProduct ?? null)
  const parts: string[] = []

  if (requested.material && fallback.material && requested.material !== fallback.material) {
    parts.push(`the strongest result is ${humaniseMaterial(fallback.material)} rather than ${humaniseMaterial(requested.material)}`)
  } else if (requested.material && !fallback.material) {
    parts.push(`I could not confirm ${humaniseMaterial(requested.material)} on the strongest result`)
  }

  if (requested.finish && fallback.finish && requested.finish !== fallback.finish) {
    parts.push(`it comes through ${humaniseFinish(fallback.finish)} rather than ${humaniseFinish(requested.finish)}`)
  }

  if (parts.length === 0) return null

  return `I widened the search a little: ${parts.join(', ')}.`
}

export function humaniseMaterial(material: Exclude<MaterialPreference, null>) {
  switch (material) {
    case 'faux_leather':
      return 'faux leather'
    case 'genuine_leather':
      return 'genuine leather'
    case 'suede':
      return 'suede'
  }
}

export function humaniseFinish(finish: Exclude<FinishPreference, null>) {
  switch (finish) {
    case 'matte':
      return 'more matte'
    case 'patent':
      return 'patent'
    case 'shiny':
      return 'shinier'
  }
}

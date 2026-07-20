export const MODEL_PRICING_VERSION = "2026-07-20"

export type ModelPrice = {
  inputPerMillion: number
  outputPerMillion: number
  cachedPerMillion: number
}

export const MODEL_PRICING: Record<string, ModelPrice> = {
  "mistral-medium-3-5": {
    inputPerMillion: 0.4,
    outputPerMillion: 2,
    cachedPerMillion: 0.1,
  },
}

export const DEFAULT_MODEL_PRICE: ModelPrice = {
  inputPerMillion: 0,
  outputPerMillion: 0,
  cachedPerMillion: 0,
}

export function getModelPrice(model: string): ModelPrice {
  return MODEL_PRICING[model] ?? DEFAULT_MODEL_PRICE
}

export function calculateModelCost(input: {
  model: string
  promptTokens: number
  completionTokens: number
  cachedTokens?: number
}): number {
  const price = getModelPrice(input.model)
  return (
    (input.promptTokens * price.inputPerMillion +
      input.completionTokens * price.outputPerMillion +
      (input.cachedTokens ?? 0) * price.cachedPerMillion) /
    1_000_000
  )
}

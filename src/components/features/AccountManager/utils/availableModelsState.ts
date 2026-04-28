export function extractCachedAvailableModels(account) {
  const response = account?.availableModelsCache?.response

  if (!response) return null

  const models = response.availableModels

  return Array.isArray(models) ? models : null
}

export function resolveAvailableModels(availableModels, account) {
  if (Array.isArray(availableModels)) {
    return availableModels
  }

  return extractCachedAvailableModels(account)
}

export function mergeAppSettings<T extends object>(
  current: T | null,
  defaults: T,
  updates: Partial<T>,
): T {
  return { ...(current || defaults), ...updates }
}

export async function persistAppSettingsUpdate<T extends object>(
  current: T | null,
  defaults: T,
  updates: Partial<T>,
  save: (updates: Partial<T>) => Promise<unknown>,
): Promise<T> {
  await save(updates)
  return mergeAppSettings(current, defaults, updates)
}

export const DEFAULT_BROWSER_INCOGNITO = true

export interface BrowserIncognitoSaveResult {
  saved: boolean
  value: boolean
}

export async function persistBrowserIncognitoPreference<T>(
  previousValue: boolean,
  checked: boolean,
  updateSettings: (updates: { browserIncognito: boolean }) => Promise<T | null>,
): Promise<BrowserIncognitoSaveResult> {
  const updatedSettings = await updateSettings({ browserIncognito: checked })
  if (!updatedSettings) {
    return { saved: false, value: previousValue }
  }
  return { saved: true, value: checked }
}

export function isPrivateBrowserLoginBlocked(
  browserIncognito: boolean,
  privateBrowserSupported: boolean | null,
  checkingPrivateBrowserSupport: boolean,
): boolean {
  return browserIncognito
    && (checkingPrivateBrowserSupport || privateBrowserSupported === false)
}

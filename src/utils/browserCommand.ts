interface BrowserSelection {
  path: string;
  command?: string;
}

export function resolveBrowserSelectionCommand(browser: BrowserSelection): string {
  const detectedCommand = browser.command?.trim()
  return detectedCommand || `"${browser.path}"`
}

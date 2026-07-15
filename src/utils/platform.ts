export type DesktopPlatform = 'windows' | 'macos' | 'linux' | 'unknown'

export function detectDesktopPlatform(
  userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent,
  navigatorPlatform = typeof navigator === 'undefined' ? '' : navigator.platform,
): DesktopPlatform {
  const fingerprint = `${userAgent} ${navigatorPlatform}`.toLowerCase()
  if (fingerprint.includes('windows') || fingerprint.includes('win32') || fingerprint.includes('win64')) {
    return 'windows'
  }
  if (fingerprint.includes('macintosh') || fingerprint.includes('macintel') || fingerprint.includes('macos')) {
    return 'macos'
  }
  if (fingerprint.includes('linux') || fingerprint.includes('x11')) {
    return 'linux'
  }
  return 'unknown'
}

export function isKskIdeSupported(platform = detectDesktopPlatform()): boolean {
  return platform === 'windows'
}

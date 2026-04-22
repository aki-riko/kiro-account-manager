export type ProviderType = 'Github' | 'GitHub' | 'Google' | 'Kiro' | string;

export function isGitHubProvider(provider: ProviderType): boolean {
  return provider === 'Github' || provider === 'GitHub'
}

export function normalizeProviderId(provider: ProviderType): string {
  return isGitHubProvider(provider) ? 'Github' : provider
}

export function getProviderDisplayName(provider: ProviderType): string {
  return isGitHubProvider(provider) ? 'Github' : provider
}

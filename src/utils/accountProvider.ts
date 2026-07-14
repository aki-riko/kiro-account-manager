export type ProviderType = 'Github' | 'GitHub' | 'Google' | 'Kiro' | string;

export function isGitHubProvider(provider: ProviderType): boolean {
  return provider === 'Github' || provider === 'GitHub'
}

export function normalizeProviderId(provider: ProviderType): string {
  return isGitHubProvider(provider) ? 'Github' : provider
}

export function getProviderDisplayName(provider: ProviderType): string {
  if (isGitHubProvider(provider)) return 'Github'
  return provider === 'ExternalIdp' ? 'Azure / Entra' : provider
}

export function isExternalIdpAccount(account: { provider?: string; authMethod?: string }): boolean {
  return account.authMethod?.toLowerCase() === 'external_idp'
    || account.provider?.toLowerCase() === 'externalidp'
}

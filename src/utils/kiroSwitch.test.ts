import assert from 'node:assert/strict'
import test from 'node:test'

import { buildSwitchParams } from './kiroSwitch'

test('external IdP switch params preserve OIDC and profile metadata without social fallback', () => {
  const params = buildSwitchParams({
    accessToken: 'access-fixture',
    refreshToken: 'refresh-fixture',
    provider: 'ExternalIdp',
    authMethod: 'external_idp',
    clientId: 'azure-client',
    tokenEndpoint: 'token-endpoint-fixture',
    issuerUrl: 'issuer-fixture',
    scopes: 'openid profile offline_access',
    audience: 'api://kiro',
    profileArn: 'arn:aws:codewhisperer:eu-central-1:123456789012:profile/external',
    profileName: 'Azure Profile',
    region: 'eu-central-1',
    expiresAt: '2026/07/14 23:45:00',
    email: 'azure@example.test',
  })

  assert.deepEqual(params, {
    accessToken: 'access-fixture',
    refreshToken: 'refresh-fixture',
    provider: 'ExternalIdp',
    authMethod: 'external_idp',
    email: 'azure@example.test',
    clientId: 'azure-client',
    tokenEndpoint: 'token-endpoint-fixture',
    issuerUrl: 'issuer-fixture',
    scopes: 'openid profile offline_access',
    audience: 'api://kiro',
    profileArn: 'arn:aws:codewhisperer:eu-central-1:123456789012:profile/external',
    profileName: 'Azure Profile',
    region: 'eu-central-1',
    expiresAt: '2026/07/14 23:45:00',
  })
})

test('external IdP detection takes precedence over IdC-shaped metadata', () => {
  const params = buildSwitchParams({
    accessToken: 'access-fixture',
    refreshToken: 'refresh-fixture',
    provider: 'ExternalIdp',
    authMethod: 'external_idp',
    clientIdHash: 'must-not-force-idc',
  })

  assert.equal(params.authMethod, 'external_idp')
  assert.equal(params.provider, 'ExternalIdp')
  assert.equal(params.clientIdHash, undefined)
  assert.equal(params.startUrl, undefined)
})

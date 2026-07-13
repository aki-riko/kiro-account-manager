import assert from 'node:assert/strict'
import test from 'node:test'

import type { Account } from '../types/account'
import { getManagedKskEligibility } from './kskIde'

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'account-id',
    provider: 'Github',
    refreshToken: 'refresh-fixture',
    authMethod: 'social',
    ...overrides,
  }
}

test('managed KSK accepts social accounts with refresh credentials', () => {
  assert.deepEqual(getManagedKskEligibility(account()), { eligible: true, reason: '' })
})

test('managed KSK rejects external_idp but allows IdC profile self-healing', () => {
  assert.equal(getManagedKskEligibility(account({ authMethod: 'external_idp' })).eligible, false)
  assert.equal(getManagedKskEligibility(account({
    provider: 'Enterprise',
    authMethod: 'IdC',
    profileArn: '',
  })).eligible, true)
  assert.equal(getManagedKskEligibility(account({
    provider: 'Enterprise',
    authMethod: 'IdC',
    profileArn: 'arn:aws:codewhisperer:us-east-1:1:profile/test',
  })).eligible, true)
})

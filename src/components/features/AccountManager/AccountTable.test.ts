import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('AccountTable avoids dynamic row measurement that triggers virtual flushSync warnings', async () => {
  const source = await readFile(new URL('./AccountTable.tsx', import.meta.url), 'utf8')

  assert.match(source, /estimateSize:\s*\(\)\s*=>\s*320/)
  assert.doesNotMatch(source, /measureElement:\s*\(/)
  assert.doesNotMatch(source, /ref=\{rowVirtualizer\.measureElement\}/)
})

test('AccountTable hides remote deletion for External IdP accounts', async () => {
  const source = await readFile(new URL('./AccountTable.tsx', import.meta.url), 'utf8')

  assert.match(source, /isExternalIdpAccount\(account\)/)
  assert.match(
    source,
    /!isExternalIdpAccount\(account\)\s*&&\s*account\.provider\s*!==\s*'Enterprise'/,
  )
})

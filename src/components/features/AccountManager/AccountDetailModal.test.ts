import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./AccountDetailModal.tsx', import.meta.url), 'utf8')

assert.match(source, /onRefresh\?\.\(\)/)
assert.match(source, /setForm\(prev => \(\{ \.\.\.prev, quota, used, status: updated\.status \}\)\)[\s\S]*onRefresh\?\.\(\)/)

console.log('AccountDetailModal refresh notifies parent list after local state update')

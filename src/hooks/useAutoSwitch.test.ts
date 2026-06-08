import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./useAutoSwitch.ts', import.meta.url), 'utf8')

assert.match(source, /export function useAutoSwitch\(\)/)
assert.match(source, /return \{\}/)
assert.doesNotMatch(source, /invoke\(/)
assert.doesNotMatch(source, /get_kiro_local_token/)
assert.doesNotMatch(source, /switch_kiro_account/)
assert.doesNotMatch(source, /update_account/)

console.log('useAutoSwitch is a backend-driven frontend stub')

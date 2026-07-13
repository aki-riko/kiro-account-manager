import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./EditAccountModal.tsx', import.meta.url), 'utf8')

assert.match(source, /import \{[^}]*updateAccount[^}]*\} from '\.\.\/\.\.\/\.\.\/api\/accountApi'/s)
assert.match(source, /await updateAccount(?:<[^>]+>)?\(params\)/)
assert.doesNotMatch(source, /invoke(?:<[^>]+>)?\('update_account'/)

console.log('EditAccountModal update_account wiring looks correct')

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./AccountDetailModal.tsx', import.meta.url), 'utf8')

assert.doesNotMatch(source, /useEffect\(\(\) => \{\s*fetchModels\(\)\s*\}, \[account\.id\]\)/)
assert.match(source, /const handleToggleModelsExpanded = \(\) => \{[\s\S]*fetchModels\(\)[\s\S]*\}/)

console.log('AccountDetailModal lazily loads available models only when expanded')

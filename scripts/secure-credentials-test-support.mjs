import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import ts from 'typescript'
export const load = (file, deps = {}) => {
  const js = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  const module = { exports: {} }
  new Script(`(function(require,module,exports){${js}\n})`).runInThisContext()(name => {
    assert.ok(name in deps, `Unexpected dependency ${name}`)
    return deps[name]
  }, module, module.exports)
  return module.exports
}
export const secureModule = load('src/utils/secureCredentials.ts')
export const migration = load('src/utils/secureCredentialMigration.ts', { './secureCredentials': secureModule })
export const fakeSecure = () => {
  const tokens = new Map()
  let failure = false
  const backend = {
    set: async(key, token) => { if (failure) throw Error('locked'); tokens.set(key, token) },
    get: async key => { if (failure) throw Error('locked'); return tokens.get(key) ?? null },
    clear: async key => { tokens.delete(key) },
  }
  const secure = secureModule.createSecureCredentials(backend)
  return { ...secureModule, default: secure, ...secure, tokens, backend, fail: value => { failure = value } }
}

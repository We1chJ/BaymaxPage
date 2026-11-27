// Tiny bundler: strips TS types with Node's built-in stripper and wraps each
// module of bloub's framework-free engine in a function scope. Output: one
// classic script exposing `window.BloubBot`.
import { stripTypeScriptTypes } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'

const [, , repo, out] = process.argv
const src = resolve(repo, 'src')
const ENTRIES = {
  'bot/engine': ['BotEngine'],
  'bot/states': ['STATE_BY_ID', 'SEQUENCE'],
  'bot/cycles': ['defaultCycle'],
  'bot/repere': ['DEMI_VIEWBOX', 'RAYON'],
  'bot/skins': ['mixHex'],
  'bot/decor': ['NOTIF_BLUE'],
  'bot/expressions': ['EXPRESSION_BY_ID', 'DEFAULT_EXPRESSION'],
  'bot/math': ['clamp', 'easings'],
  'ui/gaze': ['tourLook', 'TOUR_TIME', 'YAW_MAX', 'PITCH_MAX'],
}

const mods = new Map() // id -> { code, deps }
const order = []
const IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]\s*;?/g

function idOf(spec, fromId) {
  if (spec.startsWith('@/')) return spec.slice(2)
  return relative(src, resolve(src, dirname(fromId), spec))
}

function load(id) {
  if (mods.has(id)) return
  mods.set(id, null)
  let code = stripTypeScriptTypes(readFileSync(resolve(src, id + '.ts'), 'utf8'), { mode: 'strip' })
  const deps = []
  code = code.replace(IMPORT_RE, (_, names, spec) => {
    const dep = idOf(spec, id)
    deps.push(dep)
    const list = names.split(',').map((s) => s.trim()).filter((s) => s && !s.startsWith('type '))
      .map((s) => s.replace(/\s+as\s+/, ': '))
    return list.length ? `const { ${list.join(', ')} } = __m[${JSON.stringify(dep)}];` : ''
  })
  if (/\bimport\b[^(]/.test(code.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '').replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '')))
    throw new Error(`unhandled import left in ${id}`)
  const exported = []
  code = code.replace(/^export\s+(const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm, (_, kw, name) => {
    exported.push(name)
    return `${kw} ${name}`
  })
  if (/^export\b/m.test(code)) throw new Error(`unhandled export left in ${id}`)
  for (const d of deps) load(d)
  mods.set(id, { code, exported })
  order.push(id)
}

for (const id of Object.keys(ENTRIES)) load(id)

const license = readFileSync(resolve(repo, 'LICENSE'), 'utf8').trim().replace(/^/gm, ' * ')
let js = `/*!
 * Baymax face engine — extracted from bloub (https://github.com/jeremy-prt/bloub),
 * src/bot/ and src/ui/gaze.ts only, types stripped and bundled into one script.
 * Do not edit by hand: regenerate with: node tools/bundle-bloub.mjs <path-to-bloub-clone> bot.js
 *
${license}
 */
(() => {
"use strict";
const __m = {};
`
for (const id of order) {
  const { code, exported } = mods.get(id)
  js += `\n// ---- ${id}.ts\n__m[${JSON.stringify(id)}] = (() => {\n${code}\nreturn { ${exported.join(', ')} };\n})();\n`
}
const api = Object.entries(ENTRIES).flatMap(([id, names]) =>
  names.map((n) => {
    if (!mods.get(id).exported.includes(n)) throw new Error(`${id} does not export ${n}`)
    return `${n}: __m[${JSON.stringify(id)}].${n}`
  }))
js += `\nwindow.BloubBot = { ${api.join(', ')} };\n})();\n`
writeFileSync(out, js)
console.log(`wrote ${out}: ${order.length} modules (${order.join(', ')}), ${js.length} bytes`)

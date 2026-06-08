// Generates the domain-model docs — a Mermaid class diagram of the game's types,
// straight from the TypeScript source so they can never drift from the real
// declarations. Run via `npm run docs:model`; CI regenerates the text and fails
// if the committed copy is stale.
//
// Outputs:
//   docs/DOMAIN_MODEL.md              — the page: legend, embedded diagrams, index
//   docs/domain-model/<id>.mmd        — Mermaid source for each diagram
//   docs/domain-model/<id>.svg        — rendered diagram (only with --render)
//
// Diagrams: one `full` (every type, fully connected) plus one per area —
// `domain`, `engine`, `public-api` — each showing its own types in full with
// their outgoing edges; types from other areas appear as `<<external>>` stubs.
//
// It reads the exported `interface` and `type` declarations from SOURCES
// (syntactically, via the TS parser — no type-checking needed). Edges: hollow
// arrows for `extends` inheritance, solid arrows for associations (a field whose
// type references another declared type), labelled with the field name(s).

import ts from 'typescript'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCES = ['src/game/types.ts', 'src/game/enemies.ts', 'src/game/items.ts']
const OUT_MD = 'docs/DOMAIN_MODEL.md'
const OUT_DIR = 'docs/domain-model'
const RENDER = process.argv.includes('--render')

/**
 * @typedef {Object} Decl
 * @property {string} name
 * @property {'interface'|'enum'|'union'|'alias'} kind
 * @property {string} file
 * @property {string[]} extend            interface(s) this one extends
 * @property {{name:string,type:string}[]} members   interface fields
 * @property {string[]} values            enum / discriminated-union members
 * @property {string} [aliasText]         rendered text for a plain alias
 * @property {{target:string,label:string}[]} refs   referenced declared types
 */

/** @type {Decl[]} */
const decls = []
let sf = /** @type {ts.SourceFile} */ (/** @type {unknown} */ (null))

const isExported = (node) => (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0
const rightmost = (entity) => (ts.isQualifiedName(entity) ? entity.right.text : entity.text)
const isStringLiteralType = (node) => ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal)

/** Collect the names of every type referenced anywhere inside a type node. */
function refsIn(typeNode) {
  const found = []
  const visit = (n) => {
    if (ts.isTypeReferenceNode(n)) found.push(rightmost(n.typeName))
    n.forEachChild(visit)
  }
  visit(typeNode)
  return found
}

function collectInterface(node, file) {
  const extend = []
  for (const clause of node.heritageClauses ?? []) {
    if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
      for (const t of clause.types) extend.push(t.expression.getText(sf))
    }
  }
  const members = []
  const refs = []
  for (const m of node.members) {
    if (!ts.isPropertySignature(m) || !m.type) continue
    const label = m.name.getText(sf)
    members.push({ name: label + (m.questionToken ? '?' : ''), type: m.type.getText(sf) })
    for (const target of refsIn(m.type)) refs.push({ target, label })
  }
  decls.push({ name: node.name.text, kind: 'interface', file, extend, members, values: [], refs })
}

function collectAlias(node, file) {
  const name = node.name.text
  const t = node.type

  // A union of string literals reads as an enumeration (Direction, TileType, …).
  if (ts.isUnionTypeNode(t) && t.types.every(isStringLiteralType)) {
    const values = t.types.map((x) => x.literal.text)
    decls.push({ name, kind: 'enum', file, extend: [], members: [], values, refs: [] })
    return
  }

  // A union of object literals is a discriminated union (GameAction): surface
  // its `type` discriminants and any types its variants reference.
  if (ts.isUnionTypeNode(t) && t.types.every(ts.isTypeLiteralNode)) {
    const values = []
    const refs = []
    for (const variant of t.types) {
      for (const p of variant.members) {
        if (
          ts.isPropertySignature(p) &&
          p.name.getText(sf) === 'type' &&
          p.type &&
          ts.isLiteralTypeNode(p.type) &&
          ts.isStringLiteral(p.type.literal)
        ) {
          values.push(p.type.literal.text)
        }
      }
      for (const target of refsIn(variant)) refs.push({ target, label: '' })
    }
    decls.push({ name, kind: 'union', file, extend: [], members: [], values, refs })
    return
  }

  // Anything else (e.g. a Record) is a plain alias: show its text and edges.
  const refs = refsIn(t).map((target) => ({ target, label: '' }))
  decls.push({
    name,
    kind: 'alias',
    file,
    extend: [],
    members: [],
    values: [],
    refs,
    aliasText: t.getText(sf),
  })
}

for (const rel of SOURCES) {
  const text = readFileSync(resolve(ROOT, rel), 'utf8')
  sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, /* setParentNodes */ true)
  sf.forEachChild((node) => {
    if (ts.isInterfaceDeclaration(node) && isExported(node)) collectInterface(node, rel)
    else if (ts.isTypeAliasDeclaration(node) && isExported(node)) collectAlias(node, rel)
  })
}

const known = new Set(decls.map((d) => d.name))
const declOf = new Map(decls.map((d) => [d.name, d]))

// ---- Areas ----------------------------------------------------------------
// Engine = the reducer's private state/action contract; Public API = the hook's
// options + return views; everything else (domain model, bestiary, items) is
// the shared domain. New `*View` types auto-classify as public, new types
// elsewhere as domain.
function areaOf(d) {
  if (d.name === 'GameState' || d.name === 'GameAction') return 'engine'
  if (d.name === 'NoragonApi' || d.name === 'UseNoragonOptions' || d.name.endsWith('View'))
    return 'public'
  return 'domain'
}
for (const d of decls) d.area = areaOf(d)

const AREAS = [
  {
    id: 'domain',
    title: 'Domain',
    blurb: 'The shared game-world types: tiles, rooms, enemies, items, hero stats.',
  },
  {
    id: 'engine',
    title: 'Engine',
    blurb: "The reducer's private contract — the whole game state and every action.",
  },
  {
    id: 'public-api',
    title: 'Public API',
    blurb: 'What `useNoragon` takes and returns: options and the grouped view objects.',
  },
]
const areaKey = { domain: 'domain', engine: 'engine', 'public-api': 'public' }

// ---- Mermaid rendering ----------------------------------------------------

// Make a TypeScript type string safe to drop into a Mermaid class body: collapse
// function signatures, swap generic/union/quote tokens for plain text.
function mermaidType(t) {
  return t
    .replace(/\s+/g, ' ')
    .replace(/\([^)]*\)\s*=>\s*/g, '() ↦ ') // (args) => R  ->  () ↦ R
    .replace(/[<]/g, '«')
    .replace(/[>]/g, '»')
    .replace(/\|/g, ' / ')
    .replace(/["']/g, '')
    .replace(/:/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function classBody(d) {
  const out = [`  class ${d.name} {`]
  if (d.kind === 'enum') {
    out.push('    <<enumeration>>')
    for (const v of d.values) out.push(`    ${v}`)
  } else if (d.kind === 'union') {
    out.push('    <<union>>')
    for (const v of d.values) out.push(`    ${v}`)
  } else if (d.kind === 'alias') {
    out.push('    <<type>>')
    out.push(`    ${mermaidType(d.aliasText)}`)
  } else {
    for (const m of d.members) out.push(`    +${m.name} : ${mermaidType(m.type)}`)
  }
  out.push('  }')
  return out
}

/**
 * Build one Mermaid `classDiagram` for a set of focus types. Focus types render
 * in full; any other declared type they point at renders as an `<<external>>`
 * stub so the cross-area links still show. Only edges whose source is in focus
 * are drawn (incoming links live in the source's own area).
 */
function diagram(focusNames) {
  const focus = new Set(focusNames)
  const externals = new Set()
  const note = (target) => {
    if (known.has(target) && !focus.has(target)) externals.add(target)
  }
  for (const name of focusNames) {
    const d = declOf.get(name)
    for (const base of d.extend) note(base)
    for (const { target } of d.refs) if (target !== name) note(target)
  }

  const lines = ['classDiagram', '  direction LR']
  for (const name of focusNames) lines.push(...classBody(declOf.get(name)))
  for (const name of externals) lines.push(`  class ${name} {`, '    <<external>>', '  }')

  for (const name of focusNames) {
    const d = declOf.get(name)
    for (const base of d.extend) if (known.has(base)) lines.push(`  ${base} <|-- ${d.name}`)
    /** @type {Map<string, Set<string>>} */
    const byTarget = new Map()
    for (const { target, label } of d.refs) {
      if (!known.has(target) || target === d.name) continue
      if (!byTarget.has(target)) byTarget.set(target, new Set())
      if (label) byTarget.get(target).add(label)
    }
    for (const [target, labels] of byTarget) {
      const label = [...labels].join(', ')
      lines.push(label ? `  ${d.name} --> ${target} : ${label}` : `  ${d.name} --> ${target}`)
    }
  }
  return lines.join('\n')
}

const allNames = decls.map((d) => d.name)
const diagrams = [
  { id: 'full', title: 'Full model', blurb: 'Every type, fully connected.', focus: allNames },
  ...AREAS.map((a) => ({
    ...a,
    focus: decls.filter((d) => d.area === areaKey[a.id]).map((d) => d.name),
  })),
]

// ---- Write files ----------------------------------------------------------

mkdirSync(resolve(ROOT, OUT_DIR), { recursive: true })
for (const dg of diagrams) {
  writeFileSync(resolve(ROOT, OUT_DIR, `${dg.id}.mmd`), diagram(dg.focus) + '\n')
}

if (RENDER) {
  const mmdc = resolve(ROOT, 'node_modules/.bin/mmdc')
  const pptr = resolve(ROOT, 'scripts/puppeteer-config.json')
  for (const dg of diagrams) {
    execFileSync(
      mmdc,
      [
        '-i',
        resolve(ROOT, OUT_DIR, `${dg.id}.mmd`),
        '-o',
        resolve(ROOT, OUT_DIR, `${dg.id}.svg`),
        '-p',
        pptr,
        '-t',
        'dark',
        '-b',
        'transparent',
      ],
      { stdio: 'inherit' },
    )
  }
}

const section = (dg) => `### ${dg.title}

${dg.blurb}

\`\`\`mermaid
${diagram(dg.focus)}
\`\`\`
`

const rows = decls
  .map((d) => `| \`${d.name}\` | ${d.kind} | ${d.area} | \`${d.file}\` |`)
  .join('\n')

const md = `# Domain model

<!-- GENERATED FILE — do not edit by hand. Run \`npm run docs:model\` to regenerate.
     CI fails if the diagram text is out of date with the types. -->

> Auto-generated by \`npm run docs:model\` from ${SOURCES.map((s) => `\`${s}\``).join(', ')}.

This is every \`interface\` and \`type\` the game defines and how they connect, as
Mermaid class diagrams (rendered inline on GitHub). SVG renders of each are
produced by the CI **docs** job and uploaded as a downloadable build artifact;
run \`npm run docs:render\` to produce them locally under \`${OUT_DIR}/\`. In the
diagrams:

- **Hollow arrows** (\`<|--\`) are interface inheritance (\`extends\`).
- **Solid arrows** (\`-->\`) are associations — a field of one type whose value is
  (or contains) another declared type; the label is the field name(s).
- \`<<enumeration>>\` is a string-literal union, \`<<union>>\` a discriminated union
  (its members are the \`type\` tags), \`<<type>>\` a plain alias, and \`<<external>>\`
  a type that lives in another area (shown for context, defined in full there).

The types split into three areas — **domain** (the shared game world), **engine**
(the reducer's private state/action contract), and **public API** (what the
\`useNoragon\` hook takes and returns).

## Areas

${AREAS.map((a) => section(diagrams.find((d) => d.id === a.id))).join('\n')}
## ${diagrams[0].title}

${diagrams[0].blurb}

\`\`\`mermaid
${diagram(allNames)}
\`\`\`

## Index

| Type | Kind | Area | Source |
| ---- | ---- | ---- | ------ |
${rows}
`

writeFileSync(resolve(ROOT, OUT_MD), md)
console.log(
  `Wrote ${OUT_MD} and ${diagrams.length} diagram(s) under ${OUT_DIR}/${RENDER ? ' (with SVGs)' : ''} — ${decls.length} types.`,
)

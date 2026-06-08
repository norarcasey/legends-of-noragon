// Generates docs/DOMAIN_MODEL.md — a Mermaid class diagram of the game's types —
// straight from the TypeScript source, so it can never drift from the real
// declarations. Run via `npm run docs:model`; CI regenerates and fails if the
// committed copy is stale.
//
// It reads the exported `interface` and `type` declarations from the files in
// SOURCES (syntactically, via the TS parser — no type-checking needed), then
// emits one class per declaration plus edges: hollow arrows for `extends`
// inheritance and solid arrows for associations (a field whose type references
// another declared type).

import ts from 'typescript'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCES = ['src/game/types.ts', 'src/game/enemies.ts', 'src/game/items.ts']
const OUT = 'docs/DOMAIN_MODEL.md'

/**
 * @typedef {Object} Decl
 * @property {string} name
 * @property {'interface'|'enum'|'union'|'alias'} kind
 * @property {string} file
 * @property {string[]} extend            interface(s) this one extends
 * @property {{name:string,type:string}[]} members   interface fields
 * @property {string[]} values            enum / discriminated-union members
 * @property {string} aliasText           rendered text for a plain alias
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

// ---- Render Mermaid -------------------------------------------------------

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

const lines = ['classDiagram', '  direction LR']

for (const d of decls) {
  lines.push(`  class ${d.name} {`)
  if (d.kind === 'enum') {
    lines.push('    <<enumeration>>')
    for (const v of d.values) lines.push(`    ${v}`)
  } else if (d.kind === 'union') {
    lines.push('    <<union>>')
    for (const v of d.values) lines.push(`    ${v}`)
  } else if (d.kind === 'alias') {
    lines.push('    <<type>>')
    lines.push(`    ${mermaidType(d.aliasText)}`)
  } else {
    for (const m of d.members) lines.push(`    +${m.name} : ${mermaidType(m.type)}`)
  }
  lines.push('  }')
}

// Inheritance edges (extends).
for (const d of decls) {
  for (const base of d.extend) {
    if (known.has(base)) lines.push(`  ${base} <|-- ${d.name}`)
  }
}

// Association edges (a field referencing another declared type), deduped per
// (source, target) with the referencing field names as the label.
for (const d of decls) {
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

// ---- Write the doc --------------------------------------------------------

const rows = decls.map((d) => `| \`${d.name}\` | ${d.kind} | \`${d.file}\` |`).join('\n')

const doc = `# Domain model

<!-- GENERATED FILE — do not edit by hand. Run \`npm run docs:model\` to regenerate.
     CI fails if this file is out of date with the types. -->

> Auto-generated by \`npm run docs:model\` from ${SOURCES.map((s) => `\`${s}\``).join(', ')}.

This is every \`interface\` and \`type\` the game defines and how they connect.
In the diagram:

- **Hollow arrows** (\`<|--\`) are interface inheritance (\`extends\`).
- **Solid arrows** (\`-->\`) are associations — a field of one type whose value is
  (or contains) another declared type; the label is the field name(s).
- \`<<enumeration>>\` is a string-literal union, \`<<union>>\` a discriminated union
  (its members are the \`type\` tags), and \`<<type>>\` a plain type alias.

\`\`\`mermaid
${lines.join('\n')}
\`\`\`

## Index

| Type | Kind | Source |
| ---- | ---- | ------ |
${rows}
`

mkdirSync(resolve(ROOT, dirname(OUT)), { recursive: true })
writeFileSync(resolve(ROOT, OUT), doc)
console.log(`Wrote ${OUT} — ${decls.length} types.`)

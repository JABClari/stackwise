import { Rule, RuleMatch, StackwiseConfig } from '../../types/index.js'
import { readFileLines, findFiles } from '../utils.js'

// Detects module-level constants (arrays, objects) that are recreated on every
// render because they're defined inside the component function body.
// Grounded in: greensquare — YEARS array rebuilt on every keystroke
const inlineModuleConstants: Rule = {
  id: 'architecture/inline-module-constants',
  title: 'Static constant defined inside component — recreated on every render',
  category: 'architecture',
  severity: 2,
  effort: 1,
  blastRadius: 1,
  description:
    'Arrays and objects that never change (year ranges, option lists, config maps) ' +
    'should be defined at module level, outside the component function. ' +
    'Defining them inside the component creates a new reference on every render, ' +
    'which can also break memoization and equality checks downstream.',
  suggestedFix:
    'Move the constant above the component function. ' +
    'Use SCREAMING_SNAKE_CASE to signal it is module-level and never changes.',

  async scan(projectPath: string, _config: StackwiseConfig): Promise<RuleMatch[]> {
    const matches: RuleMatch[] = []

    const files = await findFiles(projectPath, [
      'components/**/*.tsx',
      'app/**/*.tsx',
    ])

    for (const file of files) {
      const lines = await readFileLines(file)
      let insideComponent = false
      let braceDepth = 0

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        // Rough heuristic: function/const declaration that returns JSX
        if (
          (line.includes('export function') || line.includes('export default function')) &&
          !insideComponent
        ) {
          insideComponent = true
          braceDepth = 0
        }

        if (insideComponent) {
          braceDepth += (line.match(/\{/g) || []).length
          braceDepth -= (line.match(/\}/g) || []).length

          // Large Array.from inside component body
          if (
            line.includes('Array.from(') &&
            line.includes('length') &&
            braceDepth > 0
          ) {
            matches.push({
              file,
              line: i + 1,
              matchedText: line.trim(),
              context: 'Static array built inside component — move to module level',
            })
          }

          if (braceDepth <= 0 && i > 0) insideComponent = false
        }
      }
    }

    return matches
  },
}

// Detects helper/mapping functions defined inside the component body on every render.
// Grounded in: greensquare — mapEducationFromDB defined as inline expression in useState
const inlineHelperFunctions: Rule = {
  id: 'architecture/inline-helper-functions',
  title: 'Data-mapping function defined inline inside component',
  category: 'architecture',
  severity: 2,
  effort: 1,
  blastRadius: 1,
  description:
    'Functions that transform or map data (e.g. mapFromDB, normalize, parse) ' +
    'should be defined at module level. Defined inside a component they are ' +
    'recreated on every render and cannot be reused or tested independently.',
  suggestedFix:
    'Extract the function above the component. It becomes a pure, testable utility.',

  async scan(projectPath: string, _config: StackwiseConfig): Promise<RuleMatch[]> {
    const matches: RuleMatch[] = []

    const files = await findFiles(projectPath, [
      'components/**/*.tsx',
      'components/**/*.ts',
    ])

    for (const file of files) {
      const lines = await readFileLines(file)
      let insideComponent = false
      let braceDepth = 0

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        if (
          (line.includes('export function') || line.includes('export default function')) &&
          !insideComponent
        ) {
          insideComponent = true
          braceDepth = 0
        }

        if (insideComponent) {
          braceDepth += (line.match(/\{/g) || []).length
          braceDepth -= (line.match(/\}/g) || []).length

          // const someMap/normalize/transform/parse = (x) => { inside component
          if (
            braceDepth > 1 &&
            line.match(/const\s+(map|normalize|transform|parse|format|convert)\w*\s*=\s*\(/)
          ) {
            matches.push({
              file,
              line: i + 1,
              matchedText: line.trim(),
              context: 'Data-mapping function inside component — extract to module level',
            })
          }

          if (braceDepth <= 0 && i > 0) insideComponent = false
        }
      }
    }

    return matches
  },
}

// Detects when a "use client" component is directly fetching from DB via Supabase
// client (should only happen in server context).
const clientComponentDirectDbAccess: Rule = {
  id: 'architecture/client-component-direct-db',
  title: '"use client" component importing Supabase server client',
  category: 'architecture',
  severity: 4,
  effort: 3,
  blastRadius: 4,
  description:
    'Client components must never import from @/lib/supabase/server — that module ' +
    'uses cookies() which is server-only and will throw at runtime. ' +
    'Data must be fetched in a Server Component or an API route.',
  suggestedFix:
    'Remove the Supabase server import. Fetch data in the parent Server Component ' +
    'and pass it as props, or call your own API route from the client.',

  async scan(projectPath: string, _config: StackwiseConfig): Promise<RuleMatch[]> {
    const matches: RuleMatch[] = []

    const files = await findFiles(projectPath, [
      'components/**/*.tsx',
      'components/**/*.ts',
      'app/**/*.tsx',
    ])

    for (const file of files) {
      const lines = await readFileLines(file)
      let isClientComponent = false
      let serverImportLine = 0

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line.includes('"use client"') || line.includes("'use client'")) isClientComponent = true
        if (line.includes("supabase/server")) serverImportLine = i + 1
      }

      if (isClientComponent && serverImportLine > 0) {
        matches.push({
          file,
          line: serverImportLine,
          matchedText: 'supabase/server imported in "use client" component',
          context: 'Server-only module in client component — will throw at runtime',
        })
      }
    }

    return matches
  },
}

export const architectureRules: Rule[] = [
  inlineModuleConstants,
  inlineHelperFunctions,
  clientComponentDirectDbAccess,
]

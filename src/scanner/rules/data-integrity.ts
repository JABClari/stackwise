import { Rule, RuleMatch, StackwiseConfig } from '../../types/index.js'
import { readFileLines, findFiles } from '../utils.js'

// Detects .filter() calls on data arrays that include a field that could be
// legitimately null (e.g. pre-migration rows). Silent data loss — the rows
// that fail the filter are deleted on next save.
// Grounded in: greensquare — education filter dropped rows where start_year=null
const silentFilterDataLoss: Rule = {
  id: 'data-integrity/filter-nullable-field',
  title: 'Array filter may silently drop rows with null/undefined fields',
  category: 'data-integrity',
  severity: 5,
  effort: 1,
  blastRadius: 3,
  description:
    '.filter() that tests a field for truthiness (e.g. && row.field) will silently ' +
    'exclude rows where that field is null or undefined. If this filtered array is then ' +
    'used for an INSERT/UPDATE (delete-and-reinsert pattern), existing data is lost. ' +
    'Common after migrations that add nullable columns to existing rows.',
  suggestedFix:
    'Only filter on fields that are guaranteed non-null. If the field is nullable ' +
    'by design, use a presence check on the fields that truly identify a valid row ' +
    '(e.g. institution && qualification, not && start_year which may be null pre-migration).',

  async scan(projectPath: string, _config: StackwiseConfig): Promise<RuleMatch[]> {
    const matches: RuleMatch[] = []

    const files = await findFiles(projectPath, [
      'app/api/**/*.ts',
      'app/actions/**/*.ts',
    ])

    for (const file of files) {
      const lines = await readFileLines(file)

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Pattern: .filter(...) with && checking multiple fields in same expression
        // and the file also contains .insert( — meaning filtered array goes into DB
        const isFilterWithMultipleChecks =
          line.includes('.filter(') &&
          (line.match(/&&\s*\w+\.\w+/g) || []).length >= 2

        if (isFilterWithMultipleChecks) {
          // Check if this file does inserts (delete-reinsert pattern)
          const fileContent = lines.join('\n')
          if (fileContent.includes('.insert(') && fileContent.includes('.delete(')) {
            matches.push({
              file,
              line: i + 1,
              matchedText: line.trim(),
              context:
                'Filter precedes a delete-reinsert pattern — null fields will cause row deletion',
            })
          }
        }
      }
    }

    return matches
  },
}

// Detects useState initializers that run expensive computation on every render
// instead of using the lazy initializer form.
// Grounded in: greensquare — mappedEducation .map() ran on every render
const expensiveStateInitializer: Rule = {
  id: 'data-integrity/eager-state-initializer',
  title: 'useState with inline computation runs on every render',
  category: 'data-integrity',
  severity: 2,
  effort: 1,
  blastRadius: 2,
  description:
    'useState(expensiveComputation()) runs the computation on every render ' +
    'even though React only uses the value on the first render. ' +
    'Use the lazy initializer form: useState(() => expensiveComputation()).',
  suggestedFix:
    'Wrap the initial value in an arrow function: useState(() => array.map(...))',

  async scan(projectPath: string, _config: StackwiseConfig): Promise<RuleMatch[]> {
    const matches: RuleMatch[] = []

    const files = await findFiles(projectPath, [
      'components/**/*.tsx',
      'components/**/*.ts',
      'app/**/*.tsx',
    ])

    for (const file of files) {
      const lines = await readFileLines(file)

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // useState( ... .map( or .filter( or .reduce( without arrow function wrapper
        if (
          line.includes('useState(') &&
          (line.includes('.map(') || line.includes('.filter(') || line.includes('.reduce(')) &&
          !line.includes('useState(()') &&
          !line.includes('useState(() =>')
        ) {
          matches.push({
            file,
            line: i + 1,
            matchedText: line.trim(),
            context: 'Eager initializer — use useState(() => ...) instead',
          })
        }
      }
    }

    return matches
  },
}

// Detects missing empty-array fallback that causes components to render nothing.
// Grounded in: greensquare — empty education list showed blank instead of default row
const missingEmptyStateFallback: Rule = {
  id: 'data-integrity/missing-empty-fallback',
  title: 'Array state initialized from props with no empty-array fallback',
  category: 'data-integrity',
  severity: 3,
  effort: 1,
  blastRadius: 2,
  description:
    'When state is initialized from an optional prop array using .map(), an empty ' +
    'array ([]) is truthy — the || fallback never fires. The component renders ' +
    'nothing instead of showing a blank default row.',
  suggestedFix:
    'Use an explicit length check: const mapped = (prop || []).map(...); ' +
    'useState(mapped.length > 0 ? mapped : [defaultItem])',

  async scan(projectPath: string, _config: StackwiseConfig): Promise<RuleMatch[]> {
    const matches: RuleMatch[] = []

    const files = await findFiles(projectPath, [
      'components/**/*.tsx',
      'app/**/*.tsx',
    ])

    for (const file of files) {
      const lines = await readFileLines(file)

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Pattern: useState( (something?.prop || []).map(  ...  ) || [ default ]  )
        // The || [default] is unreachable because [].map() returns [] which is truthy
        if (
          line.includes('useState(') &&
          line.includes('.map(') &&
          line.includes('|| [')
        ) {
          matches.push({
            file,
            line: i + 1,
            matchedText: line.trim(),
            context: '[].map() is truthy — the fallback || [default] never fires',
          })
        }
      }
    }

    return matches
  },
}

// Detects const X = X (self-referencing initializer) — guaranteed TDZ crash at
// module evaluation. Happens when a refactor tool does a replace-all on a
// variable name without skipping the declaration site.
// Grounded in: janecando — COLUMN_SKELETONS = COLUMN_SKELETONS caused prerender crash
const selfReferencingConst: Rule = {
  id: 'data-integrity/self-referencing-const',
  title: 'const initializer references itself — guaranteed TDZ crash',
  category: 'data-integrity',
  severity: 5,
  effort: 1,
  blastRadius: 5,
  description:
    'A const declaration whose initializer references its own name will throw ' +
    '"Cannot access X before initialization" at module evaluation time. ' +
    'This crashes every page that imports this module, including prerendering. ' +
    'Typically caused by a replace-all refactor that replaced the value inside ' +
    'the declaration itself.',
  suggestedFix:
    'Replace the initializer with the actual value: e.g. const X = [0,1,2,3,4] ' +
    'instead of const X = X.',

  async scan(projectPath: string, _config: StackwiseConfig): Promise<RuleMatch[]> {
    const matches: RuleMatch[] = []

    const files = await findFiles(projectPath, [
      'app/**/*.tsx',
      'app/**/*.ts',
      'components/**/*.tsx',
      'components/**/*.ts',
      'lib/**/*.ts',
    ])

    for (const file of files) {
      const lines = await readFileLines(file)

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Match: const IDENTIFIER = IDENTIFIER (same name, no other tokens)
        const m = line.match(/^\s*const\s+(\w+)\s*=\s*(\w+)\s*$/)
        if (m && m[1] === m[2]) {
          matches.push({
            file,
            line: i + 1,
            matchedText: line.trim(),
            context: `const ${m[1]} references itself — TDZ crash at module load`,
          })
        }
      }
    }

    return matches
  },
}

export const dataIntegrityRules: Rule[] = [
  silentFilterDataLoss,
  expensiveStateInitializer,
  missingEmptyStateFallback,
  selfReferencingConst,
]

import { Rule, RuleMatch, StackwiseConfig } from '../../types/index.js'
import { readFileLines, findFiles } from '../utils.js'

// Detects hardcoded "coming soon" / disabled UI that was placeholder and
// never wired up. These rot silently.
// Grounded in: greensquare — "Watch Profile Video" button was hardcoded disabled
const hardcodedComingSoon: Rule = {
  id: 'ux/hardcoded-coming-soon',
  title: 'Hardcoded disabled UI with "coming soon" placeholder',
  category: 'ux',
  severity: 2,
  effort: 2,
  blastRadius: 1,
  description:
    'Buttons or links hardcoded as disabled with title="Coming soon" or similar ' +
    'are placeholder UI that was never wired up. They stay disabled indefinitely ' +
    'unless explicitly tracked. Surface them so they get proper issue tracking.',
  suggestedFix:
    'Either implement the feature or replace the button with a feature-flag check ' +
    'so it can be enabled when ready. Add a TODO comment with an issue reference.',

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
        const lower = line.toLowerCase()

        if (
          (lower.includes('coming soon') || lower.includes('coming-soon')) &&
          (lower.includes('disabled') || lower.includes('title='))
        ) {
          matches.push({
            file,
            line: i + 1,
            matchedText: line.trim(),
            context: 'Hardcoded disabled placeholder — track as a real issue',
          })
        }
      }
    }

    return matches
  },
}

// Detects missing loading or skeleton state in components that fetch data
// asynchronously — users see an empty/broken UI during the fetch.
const missingLoadingState: Rule = {
  id: 'ux/missing-loading-state',
  title: 'Async data fetch with no loading state',
  category: 'ux',
  severity: 3,
  effort: 2,
  blastRadius: 2,
  description:
    'A component that fetches data via useEffect but has no loading boolean or ' +
    'skeleton renders an empty or broken UI during the fetch window. ' +
    'On slow connections this window is long enough to confuse users.',
  suggestedFix:
    'Add a loading state: const [loading, setLoading] = useState(true). ' +
    'Set it false in the finally block. Render a skeleton or spinner while loading is true.',

  async scan(projectPath: string, _config: StackwiseConfig): Promise<RuleMatch[]> {
    const matches: RuleMatch[] = []

    const files = await findFiles(projectPath, [
      'components/**/*.tsx',
      'app/**/*.tsx',
    ])

    for (const file of files) {
      const lines = await readFileLines(file)
      const fileContent = lines.join('\n')

      const hasUseEffect = fileContent.includes('useEffect(')
      const hasFetch = fileContent.includes('fetch(')
      const hasLoadingState =
        fileContent.includes('loading') ||
        fileContent.includes('isLoading') ||
        fileContent.includes('Skeleton') ||
        fileContent.includes('Loader')

      if (hasUseEffect && hasFetch && !hasLoadingState) {
        // Find the useEffect line to point at
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('useEffect(')) {
            matches.push({
              file,
              line: i + 1,
              matchedText: lines[i].trim(),
              context: 'fetch inside useEffect with no loading state — blank render during fetch',
            })
            break
          }
        }
      }
    }

    return matches
  },
}

// Detects error swallowing — catch blocks that are empty or only log,
// giving users no feedback when something fails.
const silentErrorSwallow: Rule = {
  id: 'ux/silent-error-swallow',
  title: 'catch block swallows error with no user feedback',
  category: 'ux',
  severity: 3,
  effort: 1,
  blastRadius: 2,
  description:
    'catch blocks that only call console.error (or are empty) give users no ' +
    'indication that an action failed. The UI appears to complete successfully ' +
    'while the operation silently failed.',
  suggestedFix:
    'Add user-facing error feedback: toast.error(), setError(), or an error boundary. ' +
    'Keep the console.error for debugging but add the user notification.',

  async scan(projectPath: string, _config: StackwiseConfig): Promise<RuleMatch[]> {
    const matches: RuleMatch[] = []

    const files = await findFiles(projectPath, [
      'components/**/*.tsx',
      'app/**/*.tsx',
      'app/api/**/*.ts',
    ])

    for (const file of files) {
      const lines = await readFileLines(file)

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        if (line.match(/catch\s*\(\s*\w*\s*\)\s*\{\s*\}/)) {
          // Empty catch
          matches.push({
            file,
            line: i + 1,
            matchedText: line.trim(),
            context: 'Empty catch — errors are silently swallowed',
          })
        } else if (
          line.includes('catch(') || line.includes('catch (')
        ) {
          // Look ahead: if next 1-3 lines are only console.error and }
          const nextLines = lines.slice(i + 1, i + 4).join(' ')
          if (
            nextLines.includes('console.') &&
            !nextLines.includes('toast') &&
            !nextLines.includes('setError') &&
            !nextLines.includes('throw')
          ) {
            matches.push({
              file,
              line: i + 1,
              matchedText: line.trim(),
              context: 'catch only calls console.error — no user-facing feedback',
            })
          }
        }
      }
    }

    return matches
  },
}

export const uxRules: Rule[] = [
  hardcodedComingSoon,
  missingLoadingState,
  silentErrorSwallow,
]

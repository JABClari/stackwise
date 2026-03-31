import { Rule, RuleMatch, StackwiseConfig } from '../../types/index.js'
import { readFileLines, findFiles } from '../utils.js'

// Detects useEffect that fetches reference/static data (qualifications, courses,
// config) that never changes per-user and should be fetched server-side.
// Grounded in: greensquare — qualifications and courses fetched in useEffect
// inside PortfolioSettings, re-fetched on every tab switch because the component
// unmounts/remounts.
const useEffectForStaticData: Rule = {
  id: 'performance/use-effect-static-fetch',
  title: 'useEffect fetching static reference data that should be server-side',
  category: 'performance',
  severity: 3,
  effort: 3,
  blastRadius: 3,
  description:
    'fetch() calls inside useEffect with an empty dependency array [] fetch data ' +
    'after hydration — adding latency and causing empty dropdowns/lists on initial ' +
    'render. If the data is shared and does not vary per-user (e.g. qualifications, ' +
    'categories, courses), it should be fetched in a Server Component and passed as props.',
  suggestedFix:
    'Move the fetch to the parent Server Component. Pass the data as a prop. ' +
    'The child component becomes purely presentational — no useEffect, no loading state.',

  async scan(projectPath: string, _config: StackwiseConfig): Promise<RuleMatch[]> {
    const matches: RuleMatch[] = []

    const files = await findFiles(projectPath, [
      'components/**/*.tsx',
      'components/**/*.ts',
    ])

    for (const file of files) {
      const lines = await readFileLines(file)
      let insideUseEffect = false
      let braceDepth = 0
      let useEffectStartLine = 0

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        if (line.includes('useEffect(') && line.includes('[]')) {
          insideUseEffect = true
          useEffectStartLine = i + 1
          braceDepth = 0
        }

        if (insideUseEffect) {
          braceDepth += (line.match(/\{/g) || []).length
          braceDepth -= (line.match(/\}/g) || []).length

          if (line.includes('fetch(') && line.includes('/api/')) {
            // Check if the URL looks like static reference data
            const isLikelyStatic =
              line.includes('/qualifications') ||
              line.includes('/courses') ||
              line.includes('/categories') ||
              line.includes('/config') ||
              line.includes('/types') ||
              line.includes('/options')

            if (isLikelyStatic) {
              matches.push({
                file,
                line: i + 1,
                matchedText: line.trim(),
                context: `Inside useEffect([]) at line ${useEffectStartLine} — static data should be server-fetched`,
              })
            }
          }

          if (braceDepth <= 0 && i > useEffectStartLine) {
            insideUseEffect = false
          }
        }
      }
    }

    return matches
  },
}

// Detects client components that fetch their own initial data via useEffect
// when they could receive it as props from a Server Component parent.
// Grounded in: greensquare — settings/page.tsx was fully client-side with
// useEffect fetching profile + portfolio after hydration.
const clientPageWithDataFetching: Rule = {
  id: 'performance/client-page-data-fetching',
  title: '"use client" page fetching initial data in useEffect',
  category: 'performance',
  severity: 3,
  effort: 4,
  blastRadius: 4,
  description:
    'A page marked "use client" that fetches its own data via useEffect loads ' +
    'in two phases: blank render → hydration → fetch → data render. ' +
    'In Next.js App Router, pages can be Server Components that fetch data ' +
    'before the page reaches the browser, eliminating the loading phase entirely.',
  suggestedFix:
    'Convert the page to an async Server Component. Extract interactive UI into ' +
    'a "use client" shell component. Pass server-fetched data as props to the shell. ' +
    'Use a loading.tsx file for the Suspense skeleton.',

  async scan(projectPath: string, _config: StackwiseConfig): Promise<RuleMatch[]> {
    const matches: RuleMatch[] = []

    // Only look at page files — not components
    const files = await findFiles(projectPath, ['app/**/page.tsx', 'app/**/page.ts'])

    for (const file of files) {
      const lines = await readFileLines(file)
      let isClientPage = false
      let hasUseEffect = false
      let hasFetch = false
      let useEffectLine = 0

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line.includes('"use client"') || line.includes("'use client'")) isClientPage = true
        if (line.includes('useEffect(')) { hasUseEffect = true; useEffectLine = i + 1 }
        if (line.includes('fetch(') && line.includes('/api/')) hasFetch = true
      }

      if (isClientPage && hasUseEffect && hasFetch) {
        matches.push({
          file,
          line: useEffectLine,
          matchedText: '"use client" page with useEffect data fetching',
          context: 'Convert to Server Component — fetch data before page reaches browser',
        })
      }
    }

    return matches
  },
}

// Detects useMemo used to memoize a derivation from props rather than from
// volatile local state — props are stable between renders so memoization is
// unnecessary overhead and signals the underlying issue (data should be a stable prop).
const unnecessaryMemo: Rule = {
  id: 'performance/unnecessary-memo',
  title: 'useMemo on a derivation from stable props',
  category: 'performance',
  severity: 1,
  effort: 1,
  blastRadius: 1,
  description:
    'useMemo is only valuable when its dependencies are volatile (change frequently). ' +
    'If the dependency is a prop that rarely changes, useMemo adds overhead with no benefit. ' +
    'The real fix is ensuring the data arrives as a stable prop — then a plain const suffices.',
  suggestedFix:
    'Remove useMemo. If the derivation is expensive, investigate why the prop changes ' +
    'so frequently — that is the root cause.',

  async scan(projectPath: string, _config: StackwiseConfig): Promise<RuleMatch[]> {
    const matches: RuleMatch[] = []

    const files = await findFiles(projectPath, [
      'components/**/*.tsx',
      'app/**/*.tsx',
    ])

    for (const file of files) {
      const lines = await readFileLines(file)
      const fileContent = lines.join('\n')

      // Only flag if the file also has useEffect fetching state that feeds the memo
      // (the pattern: fetch → setState → useMemo(state) is the smell, not useMemo alone)
      const hasAsyncState =
        fileContent.includes('useEffect(') &&
        fileContent.includes('fetch(') &&
        fileContent.includes('setState') || fileContent.includes('useState')

      if (!hasAsyncState) continue

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line.includes('useMemo(') && line.includes('.reduce(')) {
          matches.push({
            file,
            line: i + 1,
            matchedText: line.trim(),
            context: 'useMemo over async state — fix the data source, not the memo',
          })
        }
      }
    }

    return matches
  },
}

export const performanceRules: Rule[] = [
  useEffectForStaticData,
  clientPageWithDataFetching,
  unnecessaryMemo,
]

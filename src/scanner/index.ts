import { Rule, Issue, ScanResult, StackwiseConfig } from '../types/index.js'
import { securityRules } from './rules/security.js'
import { dataIntegrityRules } from './rules/data-integrity.js'
import { performanceRules } from './rules/performance.js'
import { architectureRules } from './rules/architecture.js'
import { uxRules } from './rules/ux.js'
import { findFiles, relativePath } from './utils.js'
import crypto from 'crypto'

const ALL_RULES: Rule[] = [
  ...securityRules,
  ...dataIntegrityRules,
  ...performanceRules,
  ...architectureRules,
  ...uxRules,
]

function issueId(ruleId: string, file: string, line?: number): string {
  const raw = `${ruleId}:${file}:${line ?? 0}`
  return crypto.createHash('md5').update(raw).digest('hex').slice(0, 8)
}

export async function scan(
  projectPath: string,
  config: StackwiseConfig,
  onProgress?: (ruleId: string, matchCount: number) => void
): Promise<ScanResult> {
  const activeRules = ALL_RULES.filter(
    (r) => !config.skipRules?.includes(r.id)
  )

  const issues: Issue[] = []

  for (const rule of activeRules) {
    const matches = await rule.scan(projectPath, config)
    onProgress?.(rule.id, matches.length)

    for (const match of matches) {
      issues.push({
        id: issueId(rule.id, match.file, match.line),
        category: rule.category,
        severity: rule.severity,
        effort: rule.effort,
        blastRadius: rule.blastRadius,
        title: rule.title,
        description: `${rule.description}${match.context ? `\n\nFound: ${match.context}` : ''}`,
        file: relativePath(projectPath, match.file),
        line: match.line,
        suggestedFix: rule.suggestedFix,
      })
    }
  }

  const allFiles = await findFiles(projectPath, [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'lib/**/*.ts',
  ])

  return {
    projectPath,
    scannedFiles: allFiles.length,
    issues,
    timestamp: new Date().toISOString(),
    adapter: config.adapter,
  }
}

export { ALL_RULES }

import chalk from 'chalk'
import { ScanResult, Plan, Issue, IssueCategory } from './types/index.js'
import { score } from './reasoner/scorer.js'

// ─── Colours ──────────────────────────────────────────────────────────────────

type ChalkFn = (text: string) => string
const SEVERITY_COLOR: Record<number, ChalkFn> = {
  5: chalk.red.bold,
  4: chalk.red,
  3: chalk.yellow,
  2: chalk.cyan,
  1: chalk.gray,
}

const SEVERITY_LABEL: Record<number, string> = {
  5: 'CRITICAL',
  4: 'HIGH    ',
  3: 'MEDIUM  ',
  2: 'LOW     ',
  1: 'INFO    ',
}

const CATEGORY_ICON: Record<IssueCategory, string> = {
  'security': '🔐',
  'data-integrity': '⚠️ ',
  'performance': '⚡',
  'architecture': '🏗 ',
  'ux': '👤',
}

// ─── Scan output ─────────────────────────────────────────────────────────────

export function renderScanResult(result: ScanResult): void {
  const { issues, scannedFiles, timestamp } = result

  console.log()
  console.log(chalk.bold('STACKWISE SCAN RESULTS'))
  console.log(chalk.gray('─'.repeat(60)))
  console.log(chalk.gray(`Scanned ${scannedFiles} files · ${new Date(timestamp).toLocaleString()}`))
  console.log(chalk.gray(`Adapter: ${result.adapter}`))
  console.log()

  if (issues.length === 0) {
    console.log(chalk.green.bold('✓ No issues found'))
    return
  }

  const critical = issues.filter((i) => i.severity >= 4)
  const rest = issues.filter((i) => i.severity < 4)

  console.log(
    chalk.bold(`Found ${issues.length} issue${issues.length === 1 ? '' : 's'}`) +
    (critical.length > 0
      ? chalk.red(` · ${critical.length} critical`)
      : '')
  )
  console.log()

  const sorted = [...issues].sort((a, b) => score(b) - score(a))

  for (const issue of sorted) {
    renderIssue(issue)
  }
}

function renderIssue(issue: Issue): void {
  const color = SEVERITY_COLOR[issue.severity] || chalk.white
  const label = SEVERITY_LABEL[issue.severity] || 'INFO    '
  const icon = CATEGORY_ICON[issue.category] || '•'

  console.log(
    color(`[${label}]`) +
    ` ${icon} ` +
    chalk.bold(issue.title)
  )
  console.log(
    chalk.gray(`  ${issue.file}${issue.line ? `:${issue.line}` : ''}`) +
    chalk.gray(` · score: ${score(issue).toFixed(2)}`)
  )
  if (issue.suggestedFix) {
    console.log(chalk.gray(`  Fix: ${issue.suggestedFix.split('\n')[0]}`))
  }
  console.log()
}

// ─── Plan output ─────────────────────────────────────────────────────────────

export function renderPlan(plan: Plan): void {
  console.log()
  console.log(chalk.bold('STACKWISE PLAN'))
  console.log(chalk.gray('─'.repeat(60)))
  console.log(
    `${plan.totalIssues} issues · ` +
    (plan.criticalCount > 0 ? chalk.red.bold(`${plan.criticalCount} critical`) + ' · ' : '') +
    `${plan.phases.length} phases`
  )
  console.log()

  for (const phase of plan.phases) {
    console.log(
      chalk.bold.white(`PHASE ${phase.number}`) +
      ' — ' +
      chalk.bold(phase.label) +
      chalk.gray(` [~${phase.estimatedTokens.toLocaleString()} tokens · ~${phase.estimatedMinutes} min]`)
    )
    console.log(chalk.gray(`  ${phase.rationale}`))
    console.log()

    for (const issue of phase.issues) {
      const color = SEVERITY_COLOR[issue.severity] || chalk.white
      const icon = CATEGORY_ICON[issue.category] || '•'
      console.log(
        `  ${color('•')} ${icon} ${issue.title}`
      )
      console.log(
        chalk.gray(`      ${issue.file}${issue.line ? `:${issue.line}` : ''}`)
      )
    }

    console.log()
  }
}

// ─── Status output ────────────────────────────────────────────────────────────

export function renderStatus(scan: ScanResult | null, plan: Plan | null): void {
  console.log()
  console.log(chalk.bold('STACKWISE STATUS'))
  console.log(chalk.gray('─'.repeat(60)))

  if (!scan) {
    console.log(chalk.yellow('No scan found. Run: stackwise scan'))
    return
  }

  console.log(chalk.green('✓') + ` Last scan: ${new Date(scan.timestamp).toLocaleString()}`)
  console.log(`  ${scan.issues.length} issues across ${scan.scannedFiles} files`)

  if (!plan) {
    console.log()
    console.log(chalk.yellow('No plan generated yet. Run: stackwise plan'))
    return
  }

  console.log(chalk.green('✓') + ` Last plan: ${new Date(plan.generatedAt).toLocaleString()}`)
  console.log(`  ${plan.phases.length} phases`)

  for (const phase of plan.phases) {
    console.log(
      chalk.gray(`  Phase ${phase.number}: `) +
      phase.label +
      chalk.gray(` (${phase.issues.length} issues, ~${phase.estimatedMinutes} min)`)
    )
  }

  console.log()
}

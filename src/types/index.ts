// ─── Issue ────────────────────────────────────────────────────────────────────

export type IssueCategory =
  | 'security'
  | 'data-integrity'
  | 'performance'
  | 'architecture'
  | 'ux'

export type Severity = 1 | 2 | 3 | 4 | 5  // 5 = critical
export type Effort   = 1 | 2 | 3 | 4 | 5  // 5 = very hard
export type Blast    = 1 | 2 | 3 | 4 | 5  // 5 = many dependents

export interface Issue {
  id: string
  category: IssueCategory
  severity: Severity
  effort: Effort
  blastRadius: Blast
  title: string
  description: string
  file: string
  line?: number
  suggestedFix?: string
  // IDs of issues that must be resolved before this one
  dependsOn?: string[]
}

// Priority score derived from scoring model — not stored, always computed
export function priorityScore(issue: Issue): number {
  return issue.severity * (1 / issue.effort) * issue.blastRadius
}

// ─── Phase ────────────────────────────────────────────────────────────────────

export interface Phase {
  number: number
  label: string
  rationale: string
  issues: Issue[]
  estimatedTokens: number
  estimatedMinutes: number
}

// ─── Scan result ──────────────────────────────────────────────────────────────

export interface ScanResult {
  projectPath: string
  scannedFiles: number
  issues: Issue[]
  timestamp: string
  adapter: string
}

// ─── Plan ─────────────────────────────────────────────────────────────────────

export interface Plan {
  phases: Phase[]
  totalIssues: number
  criticalCount: number   // severity >= 4
  generatedAt: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface StackwiseConfig {
  adapter: 'nextjs' | 'supabase' | 'generic'
  skipRules?: string[]
  anthropicModel?: string
  maxFileSizeKb?: number
}

// ─── Rule ─────────────────────────────────────────────────────────────────────

export interface RuleMatch {
  file: string
  line?: number
  matchedText?: string
  context?: string
}

export interface Rule {
  id: string
  title: string
  category: IssueCategory
  severity: Severity
  effort: Effort
  blastRadius: Blast
  description: string
  suggestedFix?: string
  // Returns matches found in the project — empty array = no issues
  scan(projectPath: string, config: StackwiseConfig): Promise<RuleMatch[]>
}

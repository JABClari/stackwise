import { Issue } from '../types/index.js'

/**
 * Priority score = severity × (1 / effort) × blastRadius
 *
 * High severity + low effort + high blast radius = fix first.
 * This matches the intuitive ordering used in the GreenSquare session:
 * - Data loss filter (severity 5, effort 1, blast 3) → Phase 1
 * - Admin client misuse (severity 4, effort 2, blast 4) → Phase 2
 * - Architecture refactor (severity 3, effort 4, blast 4) → Phase 3
 */
export function score(issue: Issue): number {
  return issue.severity * (1 / issue.effort) * issue.blastRadius
}

export function sortByPriority(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => score(b) - score(a))
}

export function categoriseByUrgency(issues: Issue[]): {
  critical: Issue[]   // severity >= 4
  high: Issue[]       // severity === 3
  medium: Issue[]     // severity === 2
  low: Issue[]        // severity === 1
} {
  return {
    critical: issues.filter((i) => i.severity >= 4),
    high: issues.filter((i) => i.severity === 3),
    medium: issues.filter((i) => i.severity === 2),
    low: issues.filter((i) => i.severity === 1),
  }
}

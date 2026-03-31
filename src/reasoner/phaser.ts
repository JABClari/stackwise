import Anthropic from '@anthropic-ai/sdk'
import { Issue, Phase, Plan } from '../types/index.js'
import { sortByPriority, categoriseByUrgency } from './scorer.js'
import { estimateTokens, estimateMinutes } from './estimator.js'

/**
 * Fallback phaser — no AI required.
 * Groups issues by urgency tier using the priority score.
 * Used when no ANTHROPIC_API_KEY is set, or as a fast-path option.
 */
export function phaseLocally(issues: Issue[]): Plan {
  const sorted = sortByPriority(issues)
  const { critical, high, medium, low } = categoriseByUrgency(sorted)

  const phases: Phase[] = []

  if (critical.length > 0) {
    const tokens = estimateTokens(critical)
    phases.push({
      number: 1,
      label: 'Critical — fix immediately',
      rationale:
        'These issues cause data loss, security vulnerabilities, or runtime crashes. ' +
        'Nothing else should be touched until these are resolved.',
      issues: critical,
      estimatedTokens: tokens,
      estimatedMinutes: estimateMinutes(tokens),
    })
  }

  if (high.length > 0) {
    const tokens = estimateTokens(high)
    phases.push({
      number: phases.length + 1,
      label: 'High — user-facing correctness',
      rationale:
        'These issues cause incorrect behaviour or poor UX that users notice directly. ' +
        'Low effort relative to impact — fix before architectural work.',
      issues: high,
      estimatedTokens: tokens,
      estimatedMinutes: estimateMinutes(tokens),
    })
  }

  if (medium.length > 0) {
    const tokens = estimateTokens(medium)
    phases.push({
      number: phases.length + 1,
      label: 'Medium — architecture & performance',
      rationale:
        'These issues create technical debt, slow the application, or make the ' +
        'codebase harder to maintain. Important but not blocking.',
      issues: medium,
      estimatedTokens: tokens,
      estimatedMinutes: estimateMinutes(tokens),
    })
  }

  if (low.length > 0) {
    const tokens = estimateTokens(low)
    phases.push({
      number: phases.length + 1,
      label: 'Low — polish & cleanup',
      rationale: 'Minor improvements. Address after higher-priority phases are complete.',
      issues: low,
      estimatedTokens: tokens,
      estimatedMinutes: estimateMinutes(tokens),
    })
  }

  return {
    phases,
    totalIssues: issues.length,
    criticalCount: critical.length,
    generatedAt: new Date().toISOString(),
  }
}

/**
 * AI phaser — calls Claude to reason about ordering with full context.
 * Produces richer rationale and can detect cross-issue dependencies
 * that static scoring cannot (e.g. "migration must precede API update").
 */
export async function phaseWithAI(issues: Issue[], model?: string): Promise<Plan> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY not set. Run with --no-ai to use local phasing, ' +
      'or set the env var: export ANTHROPIC_API_KEY=sk-ant-...'
    )
  }

  const client = new Anthropic({ apiKey })

  const issuesSummary = issues.map((i) => ({
    id: i.id,
    category: i.category,
    severity: i.severity,
    effort: i.effort,
    blastRadius: i.blastRadius,
    title: i.title,
    file: i.file,
    line: i.line,
    suggestedFix: i.suggestedFix,
  }))

  const prompt = `You are a senior software architect reviewing a codebase audit.
Below is a list of issues found by the stackwise scanner. Each issue has:
- id, category, severity (1-5, 5=critical), effort (1-5, 5=hardest), blastRadius (1-5)
- title, file location, and a suggested fix

Your job: group these issues into ordered phases that a developer should work through.

Rules for phasing:
1. Data loss and security issues ALWAYS come first, regardless of effort
2. Database/schema migrations must come before the API routes that use them
3. API routes must come before the UI components that call them
4. Never group items in the same phase if one depends on the other being done first
5. Each phase should be completable in one focused session
6. Maximum 6 phases — if there are many low-severity items, batch them together

For each phase, provide:
- A short label (e.g. "Critical — data integrity")
- A rationale paragraph explaining WHY these items are grouped and why they come first
- The list of issue IDs in this phase

Issues to phase:
${JSON.stringify(issuesSummary, null, 2)}

Respond with valid JSON only. No markdown, no explanation outside the JSON.
Schema:
{
  "phases": [
    {
      "label": "string",
      "rationale": "string",
      "issueIds": ["string"]
    }
  ]
}`

  const response = await client.messages.create({
    model: model || 'claude-opus-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = (response.content[0] as any).text
  let parsed: { phases: { label: string; rationale: string; issueIds: string[] }[] }

  try {
    parsed = JSON.parse(raw)
  } catch {
    // Claude returned markdown-wrapped JSON — strip it
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    parsed = JSON.parse(jsonMatch?.[1] ?? raw)
  }

  const issueMap = new Map(issues.map((i) => [i.id, i]))

  const phases: Phase[] = parsed.phases.map((p, idx) => {
    const phaseIssues = p.issueIds
      .map((id) => issueMap.get(id))
      .filter((i): i is Issue => !!i)

    const tokens = estimateTokens(phaseIssues)

    return {
      number: idx + 1,
      label: p.label,
      rationale: p.rationale,
      issues: phaseIssues,
      estimatedTokens: tokens,
      estimatedMinutes: estimateMinutes(tokens),
    }
  })

  return {
    phases,
    totalIssues: issues.length,
    criticalCount: issues.filter((i) => i.severity >= 4).length,
    generatedAt: new Date().toISOString(),
  }
}

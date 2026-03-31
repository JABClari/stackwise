import { Issue } from '../types/index.js'

/**
 * Token estimation per issue.
 * Based on observed token usage in the GreenSquare session:
 * - Effort 1 (one-line fix): ~150 tokens
 * - Effort 2 (small refactor, ~5-10 lines): ~400 tokens
 * - Effort 3 (medium refactor, new function/component): ~800 tokens
 * - Effort 4 (significant structural change, new file): ~1500 tokens
 * - Effort 5 (multi-file architectural change): ~3000 tokens
 *
 * Includes overhead for reading context + explanation (~200 tokens flat).
 */
const TOKENS_BY_EFFORT: Record<number, number> = {
  1: 150,
  2: 400,
  3: 800,
  4: 1500,
  5: 3000,
}

const READING_OVERHEAD = 200

export function estimateTokens(issues: Issue[]): number {
  return issues.reduce((total, issue) => {
    return total + (TOKENS_BY_EFFORT[issue.effort] ?? 400) + READING_OVERHEAD
  }, 0)
}

/**
 * Rough time estimate assuming ~500 tokens/minute for reading+writing
 * with an AI assistant in an interactive session.
 */
export function estimateMinutes(tokens: number): number {
  return Math.ceil(tokens / 500)
}

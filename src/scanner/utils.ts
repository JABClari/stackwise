import { promises as fs } from 'fs'
import { glob } from 'glob'
import path from 'path'

export async function findFiles(projectPath: string, patterns: string[]): Promise<string[]> {
  const results: string[] = []

  for (const pattern of patterns) {
    const found = await glob(pattern, {
      cwd: projectPath,
      absolute: true,
      ignore: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/.git/**'],
    })
    results.push(...found)
  }

  // Deduplicate
  return [...new Set(results)]
}

export async function readFileLines(filePath: string): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return content.split('\n')
  } catch {
    return []
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export function relativePath(projectPath: string, absolutePath: string): string {
  return path.relative(projectPath, absolutePath)
}

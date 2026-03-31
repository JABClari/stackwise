import { promises as fs } from 'fs'
import path from 'path'
import { ScanResult, Plan } from '../types/index.js'

const SESSION_DIR = '.stackwise'
const SCAN_FILE = 'last-scan.json'
const PLAN_FILE = 'last-plan.json'

async function ensureDir(projectPath: string): Promise<void> {
  const dir = path.join(projectPath, SESSION_DIR)
  await fs.mkdir(dir, { recursive: true })
}

export async function saveScan(projectPath: string, result: ScanResult): Promise<void> {
  await ensureDir(projectPath)
  const filePath = path.join(projectPath, SESSION_DIR, SCAN_FILE)
  await fs.writeFile(filePath, JSON.stringify(result, null, 2), 'utf-8')
}

export async function loadScan(projectPath: string): Promise<ScanResult | null> {
  const filePath = path.join(projectPath, SESSION_DIR, SCAN_FILE)
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as ScanResult
  } catch {
    return null
  }
}

export async function savePlan(projectPath: string, plan: Plan): Promise<void> {
  await ensureDir(projectPath)
  const filePath = path.join(projectPath, SESSION_DIR, PLAN_FILE)
  await fs.writeFile(filePath, JSON.stringify(plan, null, 2), 'utf-8')
}

export async function loadPlan(projectPath: string): Promise<Plan | null> {
  const filePath = path.join(projectPath, SESSION_DIR, PLAN_FILE)
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as Plan
  } catch {
    return null
  }
}

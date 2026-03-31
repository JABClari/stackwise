import path from 'path'
import { loadScan, loadPlan } from '../memory/session.js'
import { renderStatus } from '../renderer.js'

export async function runStatus(targetPath: string): Promise<void> {
  const projectPath = path.resolve(targetPath)
  const [scan, plan] = await Promise.all([
    loadScan(projectPath),
    loadPlan(projectPath),
  ])
  renderStatus(scan, plan)
}

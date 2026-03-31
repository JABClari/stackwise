import ora from 'ora'
import path from 'path'
import { loadScan, savePlan } from '../memory/session.js'
import { phaseLocally, phaseWithAI } from '../reasoner/phaser.js'
import { renderPlan } from '../renderer.js'

interface PlanOptions {
  noAi?: boolean
  model?: string
}

export async function runPlan(targetPath: string, options: PlanOptions): Promise<void> {
  const projectPath = path.resolve(targetPath)

  const scan = await loadScan(projectPath)
  if (!scan) {
    console.error('No scan found. Run `stackwise scan` first.')
    process.exit(1)
  }

  if (scan.issues.length === 0) {
    console.log('No issues to plan — your codebase is clean.')
    return
  }

  let plan

  if (options.noAi || !process.env.ANTHROPIC_API_KEY) {
    if (!options.noAi && !process.env.ANTHROPIC_API_KEY) {
      console.log('ANTHROPIC_API_KEY not set — using local phasing (set key for AI-powered ordering)')
      console.log()
    }
    const spinner = ora('Generating plan...').start()
    plan = phaseLocally(scan.issues)
    spinner.succeed('Plan generated (local scoring)')
  } else {
    const spinner = ora('Asking Claude to reason about issue ordering...').start()
    try {
      plan = await phaseWithAI(scan.issues, options.model)
      spinner.succeed('Plan generated (AI-assisted)')
    } catch (err: any) {
      spinner.fail('AI phasing failed — falling back to local scoring')
      console.error(err.message)
      plan = phaseLocally(scan.issues)
    }
  }

  await savePlan(projectPath, plan)

  renderPlan(plan)

  console.log('Plan saved to .stackwise/last-plan.json')
  console.log('Work through each phase in order. Re-run `stackwise scan` after each phase to track progress.')
}

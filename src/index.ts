#!/usr/bin/env node

import { Command } from 'commander'
import { runScan } from './commands/scan.js'
import { runPlan } from './commands/plan.js'
import { runStatus } from './commands/status.js'

const program = new Command()

program
  .name('stackwise')
  .description(
    'Audit-first CLI agent: scans a codebase, scores issues by severity/effort/blast-radius,\n' +
    'and produces an ordered phase plan for humans or AI agents to execute.'
  )
  .version('0.1.0')

program
  .command('scan [path]')
  .description('Scan a codebase and surface issues by category')
  .option('--adapter <type>', 'Stack adapter: nextjs | supabase | generic', 'nextjs')
  .option('--skip <rules>', 'Comma-separated rule IDs to skip')
  .action((targetPath = '.', options) => {
    runScan(targetPath, options).catch((err) => {
      console.error('Scan failed:', err.message)
      process.exit(1)
    })
  })

program
  .command('plan [path]')
  .description('Generate a prioritised phase plan from the last scan')
  .option('--no-ai', 'Skip AI reasoning, use local scoring only')
  .option('--model <model>', 'Claude model to use for AI phasing', 'claude-opus-4-6')
  .action((targetPath = '.', options) => {
    runPlan(targetPath, options).catch((err) => {
      console.error('Plan failed:', err.message)
      process.exit(1)
    })
  })

program
  .command('status [path]')
  .description('Show current session state: last scan and plan')
  .action((targetPath = '.') => {
    runStatus(targetPath).catch((err) => {
      console.error('Status failed:', err.message)
      process.exit(1)
    })
  })

program.parse()

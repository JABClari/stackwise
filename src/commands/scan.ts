import ora from 'ora'
import path from 'path'
import { scan } from '../scanner/index.js'
import { saveScan } from '../memory/session.js'
import { renderScanResult } from '../renderer.js'
import { StackwiseConfig } from '../types/index.js'

interface ScanOptions {
  adapter: string
  skip?: string
}

export async function runScan(targetPath: string, options: ScanOptions): Promise<void> {
  const projectPath = path.resolve(targetPath)

  const config: StackwiseConfig = {
    adapter: (options.adapter as StackwiseConfig['adapter']) || 'nextjs',
    skipRules: options.skip ? options.skip.split(',').map((s) => s.trim()) : [],
  }

  const spinner = ora('Scanning codebase...').start()

  const result = await scan(projectPath, config, (ruleId, count) => {
    if (count > 0) {
      spinner.text = `Scanning... found ${count} match(es) in ${ruleId}`
    }
  })

  spinner.succeed(`Scanned ${result.scannedFiles} files, found ${result.issues.length} issues`)

  await saveScan(projectPath, result)

  renderScanResult(result)

  console.log(`Results saved to .stackwise/last-scan.json`)
  console.log(`Run ${`stackwise plan`} to generate a prioritised phase plan.`)
}

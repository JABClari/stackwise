import { Rule, RuleMatch, StackwiseConfig } from '../../types/index.js'
import { readFileLines, findFiles } from '../utils.js'

// Detects super-admin API routes that should use a service-role/admin client
// but are using the regular (RLS-restricted) client for data mutations.
// Grounded in: greensquare session — verification, tokens, cms, universities
// all used createClient() instead of createAdminClient() for admin writes.
const adminClientMisuse: Rule = {
  id: 'security/admin-client-misuse',
  title: 'Super-admin route using RLS-restricted client for data write',
  category: 'security',
  severity: 4,
  effort: 2,
  blastRadius: 4,
  description:
    'API routes under /super/ or /admin/ that perform INSERT, UPDATE, or DELETE ' +
    'using the regular createClient() will fail silently when RLS blocks the operation. ' +
    'These routes must use a service-role client that bypasses RLS.',
  suggestedFix:
    'Import createAdminClient and use it for all data mutations in admin routes. ' +
    'Keep createClient() only for auth.getUser() to verify the caller is authenticated.',

  async scan(projectPath: string, _config: StackwiseConfig): Promise<RuleMatch[]> {
    const matches: RuleMatch[] = []

    // Only look inside admin/super route directories
    const files = await findFiles(projectPath, [
      '**/api/super/**/*.ts',
      '**/api/admin/**/*.ts',
    ])

    for (const file of files) {
      const lines = await readFileLines(file)
      let hasAdminImport = false
      let hasRegularClient = false
      let regularClientLine = 0
      let hasMutation = false

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line.includes('createAdminClient')) hasAdminImport = true
        if (line.includes('createClient()') && !line.includes('createAdminClient')) {
          hasRegularClient = true
          regularClientLine = i + 1
        }
        if (
          line.includes('.insert(') ||
          line.includes('.update(') ||
          line.includes('.delete(') ||
          line.includes('.upsert(')
        ) {
          hasMutation = true
        }
      }

      // Flag: has mutations, uses regular client, and doesn't have admin import
      if (hasMutation && hasRegularClient && !hasAdminImport) {
        matches.push({
          file,
          line: regularClientLine,
          matchedText: 'createClient() used in admin route with data mutations',
          context: 'RLS will block cross-user writes — must use service-role client',
        })
      }
    }

    return matches
  },
}

// Detects potential secret/key exposure in client-facing code
const exposedServiceKey: Rule = {
  id: 'security/exposed-service-key',
  title: 'SUPABASE_SERVICE_ROLE_KEY referenced in client-side code',
  category: 'security',
  severity: 5,
  effort: 2,
  blastRadius: 5,
  description:
    'The service role key bypasses all RLS. If referenced in a file that gets ' +
    'bundled for the browser (no "use server" / not in an API route), it will ' +
    'be exposed to every user.',
  suggestedFix:
    'Move any usage of SUPABASE_SERVICE_ROLE_KEY to server-only files ' +
    '(API routes, server actions, or files with "use server").',

  async scan(projectPath: string, _config: StackwiseConfig): Promise<RuleMatch[]> {
    const matches: RuleMatch[] = []

    const files = await findFiles(projectPath, [
      'app/**/*.ts',
      'app/**/*.tsx',
      'components/**/*.ts',
      'components/**/*.tsx',
      'lib/**/*.ts',
    ])

    for (const file of files) {
      const lines = await readFileLines(file)
      const fileContent = lines.join('\n')

      // Skip files that are legitimately server-only:
      // - anything inside /api/ (Next.js API routes run only on the server)
      // - files with "use server" directive
      // - lib/supabase/server.ts is the canonical place to define createAdminClient
      const normalised = file.replace(/\\/g, '/')
      const isServerSafe =
        normalised.includes('/api/') ||
        normalised.includes('supabase/server') ||
        fileContent.includes('"use server"') ||
        fileContent.includes("'use server'")

      if (isServerSafe) continue

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line.includes('SUPABASE_SERVICE_ROLE_KEY')) {
          matches.push({
            file,
            line: i + 1,
            matchedText: line.trim(),
            context: 'Service role key in non-server-safe file — will be bundled client-side',
          })
        }
      }
    }

    return matches
  },
}

export const securityRules: Rule[] = [adminClientMisuse, exposedServiceKey]

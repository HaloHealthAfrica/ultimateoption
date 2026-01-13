#!/usr/bin/env node

/**
 * Final ESLint fixes for remaining issues
 */

const { readFileSync, writeFileSync } = require('fs');

// Function to fix a file with multiple replacements
function fixFile(filePath, replacements) {
  try {
    let content = readFileSync(filePath, 'utf8');
    let changed = false;
    
    for (const { from, to } of replacements) {
      if (content.includes(from)) {
        content = content.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
        changed = true;
      }
    }
    
    if (changed) {
      writeFileSync(filePath, content);
      console.log(`Fixed: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error fixing ${filePath}:`, error.message);
    return false;
  }
}

// All the fixes needed
const allFixes = [
  // Remove unused error variables
  {
    file: 'src/app/api/testing/scenarios/[id]/route.ts',
    replacements: [{ from: '} catch (_error) {', to: '} catch {' }]
  },
  {
    file: 'src/app/api/webhooks/signals/route.ts',
    replacements: [{ from: '} catch (_error) {', to: '} catch {' }]
  },
  {
    file: 'src/audit/replayer.ts',
    replacements: [{ from: '} catch (_error) {', to: '} catch {' }]
  },
  {
    file: 'src/ledger/ledger.ts',
    replacements: [
      { from: '} catch (_error) {', to: '} catch {' }
    ]
  },
  {
    file: 'src/phase25/config/rules.ts',
    replacements: [{ from: '} catch (_error) {', to: '} catch {' }]
  },
  {
    file: 'src/phase25/routes/webhook.routes.ts',
    replacements: [{ from: 'private authenticationMiddleware(req: Request, res: Response', to: 'private authenticationMiddleware(req: Request, _res: Response' }]
  },
  {
    file: 'src/phase25/server.ts',
    replacements: [{ from: 'this.app.get(\'/health\', (req, res) => {', to: 'this.app.get(\'/health\', (_req, res) => {' }]
  },
  {
    file: 'src/phase25/services/audit-logger.service.ts',
    replacements: [
      { from: ': any', to: ': unknown' },
      { from: '} catch (_parseError) {', to: '} catch {' }
    ]
  },
  {
    file: 'src/phase25/services/decision-orchestrator.service.ts',
    replacements: [
      { from: 'const marketContextTime = Date.now();', to: 'const _marketContextTime = Date.now();' },
      { from: '} catch (_error) {', to: '} catch {' }
    ]
  },
  {
    file: 'src/phase25/services/error-handler.service.ts',
    replacements: [{ from: 'private logProviderFailure(provider: string', to: 'private logProviderFailure(_provider: string' }]
  },
  {
    file: 'src/phase25/services/market-context.service.ts',
    replacements: [
      { from: 'import { AxiosRequestConfig } from \'axios\';', to: '// import { AxiosRequestConfig } from \'axios\'; // Unused' },
      { from: 'const tradesData = await', to: 'const _tradesData = await' },
      { from: 'private processTradesData(tradesData: unknown', to: 'private processTradesData(_tradesData: unknown' }
    ]
  },
  {
    file: 'src/phase25/services/metrics.service.ts',
    replacements: [
      { from: 'import { MarketContext, DecisionContext } from \'../types\';', to: '// import { MarketContext, DecisionContext } from \'../types\'; // Unused' }
    ]
  },
  {
    file: 'src/phase25/services/risk-gates.service.ts',
    replacements: [
      { from: 'import { RISK_GATES, ALIGNMENT_THRESHOLDS } from \'../config/constants\';', to: 'import { RISK_GATES } from \'../config/constants\'; // ALIGNMENT_THRESHOLDS unused' }
    ]
  },
  {
    file: 'src/phase25/services/webhook.service.ts',
    replacements: [
      { from: 'import { Request, Response } from \'express\';', to: 'import { Request } from \'express\'; // Response unused' }
    ]
  },
  {
    file: 'src/phase25/testing/setup.ts',
    replacements: [
      { from: 'import { MtfDotsWebhook, UltimateOptionsWebhook, StratExecutionWebhook } from \'../types\';', to: '// import { MtfDotsWebhook, UltimateOptionsWebhook, StratExecutionWebhook } from \'../types\'; // Unused' }
    ]
  },
  {
    file: 'src/phase25/types/interfaces.ts',
    replacements: [
      { from: ': any', to: ': unknown' }
    ]
  },
  {
    file: 'src/webhooks/satyAdapter.ts',
    replacements: [{ from: '} catch (_error) {', to: '} catch {' }]
  },
  {
    file: 'src/webhooks/security.ts',
    replacements: [{ from: '} catch (_error) {', to: '} catch {' }]
  },
  {
    file: 'src/webhooks/signalAdapter.ts',
    replacements: [{ from: '} catch (_error) {', to: '} catch {' }]
  }
];

// Apply all fixes
let totalFixed = 0;
for (const fix of allFixes) {
  if (fixFile(fix.file, fix.replacements)) {
    totalFixed++;
  }
}

console.log(`\nFixed ${totalFixed} files total.`);
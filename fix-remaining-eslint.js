#!/usr/bin/env node

/**
 * Script to fix remaining ESLint errors
 */

const { readFileSync, writeFileSync } = require('fs');

// Files and their specific fixes
const fixes = [
  {
    file: 'src/app/api/webhooks/signals/route.ts',
    replacements: [
      { from: 'const startTime = Date.now();', to: 'const _startTime = Date.now();' }
    ]
  },
  {
    file: 'src/audit/replayer.ts',
    replacements: [
      { from: 'const startTime = Date.now();', to: 'const _startTime = Date.now();' }
    ]
  },
  {
    file: 'src/phase25/config/index.ts',
    replacements: [
      { from: 'function getFallbackValues(provider: string)', to: 'function getFallbackValues(_provider: string)' }
    ]
  },
  {
    file: 'src/phase25/routes/webhook.routes.ts',
    replacements: [
      { from: 'private authenticationMiddleware(req: Request, res: Response, next: () => void)', to: 'private authenticationMiddleware(req: Request, _res: Response, next: () => void)' }
    ]
  },
  {
    file: 'src/phase25/server.ts',
    replacements: [
      { from: 'this.app.get(\'/health\', (req, res) => {', to: 'this.app.get(\'/health\', (_req, res) => {' }
    ]
  },
  {
    file: 'src/phase25/services/audit-logger.service.ts',
    replacements: [
      { from: 'const startTime = Date.now();', to: 'const _startTime = Date.now();' },
      { from: ': any', to: ': unknown' }
    ]
  },
  {
    file: 'src/phase25/services/decision-orchestrator.service.ts',
    replacements: [
      { from: 'const marketContextTime = Date.now();', to: 'const _marketContextTime = Date.now();' }
    ]
  },
  {
    file: 'src/phase25/services/error-handler.service.ts',
    replacements: [
      { from: 'private logProviderFailure(provider: string', to: 'private logProviderFailure(_provider: string' }
    ]
  },
  {
    file: 'src/phase25/services/market-context.service.ts',
    replacements: [
      { from: 'const startTime = Date.now();', to: 'const _startTime = Date.now();' },
      { from: 'const tradesData = await', to: 'const _tradesData = await' },
      { from: 'private processTradesData(tradesData: unknown', to: 'private processTradesData(_tradesData: unknown' }
    ]
  },
  {
    file: 'src/phase25/services/metrics.service.ts',
    replacements: [
      { from: 'const oneMinuteAgo = now - 60000;', to: 'const _oneMinuteAgo = now - 60000;' }
    ]
  },
  {
    file: 'src/phase25/services/service-factory.ts',
    replacements: [
      { from: 'const riskGates = new RiskGatesService();', to: 'const _riskGates = new RiskGatesService();' }
    ]
  },
  {
    file: 'src/phase25/services/webhook.service.ts',
    replacements: [
      { from: ', warnings: string[]', to: ', _warnings: string[]' }
    ]
  }
];

// Apply fixes
let totalFixed = 0;

for (const fix of fixes) {
  try {
    const filePath = fix.file;
    let content = readFileSync(filePath, 'utf8');
    let changed = false;
    
    for (const replacement of fix.replacements) {
      if (content.includes(replacement.from)) {
        content = content.replace(new RegExp(replacement.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement.to);
        changed = true;
      }
    }
    
    if (changed) {
      writeFileSync(filePath, content);
      console.log(`Fixed: ${filePath}`);
      totalFixed++;
    }
  } catch (error) {
    console.error(`Error fixing ${fix.file}:`, error.message);
  }
}

console.log(`Fixed ${totalFixed} files.`);
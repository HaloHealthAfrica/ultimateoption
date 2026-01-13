#!/usr/bin/env node

/**
 * Fix console.error statements that reference removed error parameters
 */

const { readFileSync, writeFileSync } = require('fs');

const filesToFix = [
  'src/app/api/decisions/route.ts',
  'src/app/api/learning/suggestions/route.ts',
  'src/app/api/ledger/route.ts',
  'src/app/api/metrics/route.ts',
  'src/app/api/phase/current/route.ts',
  'src/app/api/signals/current/route.ts',
  'src/app/api/trend/current/route.ts',
  'src/events/eventBus.ts',
  'src/phase25/server.ts'
];

function fixFile(filePath) {
  try {
    let content = readFileSync(filePath, 'utf8');
    let changed = false;
    
    // Find catch blocks without error parameter and fix console.error statements
    const catchBlocks = content.match(/} catch \{[\s\S]*?(?=} catch|$)/g);
    
    if (catchBlocks) {
      for (const block of catchBlocks) {
        if (block.includes('console.error(') && block.includes(', error)')) {
          // Remove the error reference from console.error
          const fixedBlock = block.replace(/, error\)/g, ')');
          content = content.replace(block, fixedBlock);
          changed = true;
        }
      }
    }
    
    if (changed) {
      writeFileSync(filePath, content);
      console.log(`Fixed: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

console.log('Fixing console.error statements...');
let fixedCount = 0;

for (const file of filesToFix) {
  if (fixFile(file)) {
    fixedCount++;
  }
}

console.log(`Fixed ${fixedCount} files.`);
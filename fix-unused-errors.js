#!/usr/bin/env node

/**
 * Fix unused _error parameters by removing them
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
    
    // Replace } catch (_error) { with } catch {
    if (content.includes('} catch (_error) {')) {
      content = content.replace(/} catch \(_error\) \{/g, '} catch {');
      changed = true;
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

console.log('Fixing unused _error parameters...');
let fixedCount = 0;

for (const file of filesToFix) {
  if (fixFile(file)) {
    fixedCount++;
  }
}

console.log(`Fixed ${fixedCount} files.`);
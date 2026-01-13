#!/usr/bin/env node

/**
 * Fix missing DecisionContext imports
 */

const { readFileSync, writeFileSync, readdirSync, statSync } = require('fs');
const { join } = require('path');

function fixFile(filePath) {
  try {
    let content = readFileSync(filePath, 'utf8');
    let changed = false;
    
    // Check if file uses DecisionContext but doesn't import it
    if (content.includes('DecisionContext') && content.includes('from \'../types\'')) {
      // Check if DecisionContext is already imported
      const importMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/types['"]/);
      if (importMatch && !importMatch[1].includes('DecisionContext')) {
        // Add DecisionContext to the import
        const currentImports = importMatch[1].trim();
        const newImports = currentImports + ', DecisionContext';
        content = content.replace(importMatch[0], `import { ${newImports} } from '../types'`);
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
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Find and fix all TypeScript files in phase2
function findAndFixTsFiles(dir) {
  const items = readdirSync(dir);
  let fixedCount = 0;
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      fixedCount += findAndFixTsFiles(fullPath);
    } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
      if (fixFile(fullPath)) {
        fixedCount++;
      }
    }
  }
  
  return fixedCount;
}

console.log('Fixing DecisionContext imports...');
const fixedCount = findAndFixTsFiles(join(__dirname, 'src/phase2'));
console.log(`Fixed ${fixedCount} files.`);
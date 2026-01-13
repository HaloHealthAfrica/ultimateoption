#!/usr/bin/env node

/**
 * Fix remaining _error references
 */

const { readFileSync, writeFileSync, readdirSync, statSync } = require('fs');
const { join } = require('path');

function fixFile(filePath) {
  try {
    let content = readFileSync(filePath, 'utf8');
    let changed = false;
    
    // Replace _error with error in console.error statements
    if (content.includes('console.error(') && content.includes('_error')) {
      content = content.replace(/console\.error\([^)]*_error[^)]*\)/g, (match) => {
        return match.replace(/_error/g, 'error');
      });
      changed = true;
    }
    
    // Replace other _error references that should be error
    if (content.includes('_error') && content.includes('} catch (error) {')) {
      content = content.replace(/_error/g, 'error');
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

// Find and fix all TypeScript files
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

console.log('Fixing remaining _error references...');
const fixedCount = findAndFixTsFiles(join(__dirname, 'src'));
console.log(`Fixed ${fixedCount} files.`);
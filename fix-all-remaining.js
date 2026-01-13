#!/usr/bin/env node

/**
 * Fix all remaining compilation issues
 */

const { readFileSync, writeFileSync, readdirSync, statSync } = require('fs');
const { join } = require('path');

function fixFile(filePath) {
  try {
    let content = readFileSync(filePath, 'utf8');
    let changed = false;
    
    // Fix catch blocks that reference error but don't have error parameter
    const catchBlocks = content.match(/} catch \{[\s\S]*?(?=} catch|$)/g);
    if (catchBlocks) {
      for (const block of catchBlocks) {
        if (block.includes('error instanceof Error') || block.includes('error.message')) {
          const fixedBlock = block.replace('} catch {', '} catch (error) {');
          content = content.replace(block, fixedBlock);
          changed = true;
        }
      }
    }
    
    // Fix const variables that are reassigned
    const constReassignments = [
      { pattern: /const (\w+) = 0;[\s\S]*?\1 \+=/g, fix: (match, varName) => match.replace(`const ${varName}`, `let ${varName}`) },
      { pattern: /const (\w+) = 1\.0;[\s\S]*?\1 \*=/g, fix: (match, varName) => match.replace(`const ${varName}`, `let ${varName}`) },
      { pattern: /for \(const (i|j|k) = 0; \1 < [\w.]+; \1\+\+\)/g, fix: (match, varName) => match.replace(`const ${varName}`, `let ${varName}`) }
    ];
    
    for (const { pattern, fix } of constReassignments) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          const fixed = fix(match, match.match(/const (\w+)/)[1]);
          content = content.replace(match, fixed);
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

console.log('Fixing all remaining compilation issues...');
const fixedCount = findAndFixTsFiles(join(__dirname, 'src'));
console.log(`Fixed ${fixedCount} files.`);
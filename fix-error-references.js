#!/usr/bin/env node

/**
 * Fix error references in catch blocks
 */

const { readFileSync, writeFileSync, readdirSync, statSync } = require('fs');
const { join } = require('path');

// Function to fix error references in a file
function fixErrorReferences(filePath) {
  try {
    let content = readFileSync(filePath, 'utf8');
    let changed = false;
    
    // Pattern: } catch (_error) { ... error.something
    // Fix: Change _error back to error when it's used
    const catchBlocks = content.match(/} catch \(_error\) \{[\s\S]*?(?=} catch|$)/g);
    
    if (catchBlocks) {
      for (const block of catchBlocks) {
        if (block.includes('error instanceof Error') || block.includes('error.message')) {
          // This catch block uses the error variable, so we need to keep it
          const fixedBlock = block.replace('} catch (_error) {', '} catch (error) {');
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

// Recursively find TypeScript files
function findTsFiles(dir, files = []) {
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      findTsFiles(fullPath, files);
    } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Main execution
console.log('Fixing error references in catch blocks...');

const srcDir = join(__dirname, 'src');
const tsFiles = findTsFiles(srcDir);

let fixedCount = 0;
for (const file of tsFiles) {
  if (fixErrorReferences(file)) {
    fixedCount++;
  }
}

console.log(`Fixed ${fixedCount} files out of ${tsFiles.length} TypeScript files.`);
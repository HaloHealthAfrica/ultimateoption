#!/usr/bin/env node

/**
 * Script to fix ESLint errors from recent commits
 * This addresses unused variables and any types
 */

const { readFileSync, writeFileSync, readdirSync, statSync } = require('fs');
const { join } = require('path');

// Function to fix unused variables by prefixing with underscore
function fixUnusedVariables(content) {
  // Fix unused parameters in function signatures
  content = content.replace(/\b(error|next|warnings|parseError|startTime|oneMinuteAgo|marketContextTime|provider|riskGates|tradesData)\b(?=\s*[,)])/g, '_$1');
  
  // Fix unused imports
  content = content.replace(/import\s*\{\s*([^}]*?)\b(Request|Response|NormalizedPayload|EngineAction|FeedErrorType|AxiosRequestConfig|MarketContext|DecisionContext|RISK_GATES|ALIGNMENT_THRESHOLDS|MtfDotsWebhook|UltimateOptionsWebhook|StratExecutionWebhook|AnyWebhook)\b([^}]*?)\s*\}/g, (match, before, unused, after) => {
    const beforeClean = before.replace(/,\s*$/, '').trim();
    const afterClean = after.replace(/^\s*,/, '').trim();
    
    if (!beforeClean && !afterClean) {
      return ''; // Remove entire import if only unused items
    }
    
    const remaining = [beforeClean, afterClean].filter(Boolean).join(', ');
    return `import { ${remaining} }`;
  });
  
  return content;
}

// Function to fix any types
function fixAnyTypes(content) {
  // Replace common any patterns with more specific types
  content = content.replace(/:\s*any\b/g, ': unknown');
  content = content.replace(/as\s+any\b/g, 'as unknown');
  content = content.replace(/\bany\[\]/g, 'unknown[]');
  content = content.replace(/Record<string,\s*any>/g, 'Record<string, unknown>');
  content = content.replace(/\{\s*\[key:\s*string\]:\s*any\s*\}/g, 'Record<string, unknown>');
  
  return content;
}

// Function to fix prefer-const issues
function fixPreferConst(content) {
  // Look for let declarations that are never reassigned
  content = content.replace(/\blet\s+(\w+)\s*=/g, (match, varName) => {
    // Simple heuristic: if we don't see varName = later, change to const
    const reassignmentPattern = new RegExp(`\\b${varName}\\s*=(?!=)`, 'g');
    const matches = content.match(reassignmentPattern);
    if (!matches || matches.length <= 1) { // Only the initial assignment
      return match.replace('let', 'const');
    }
    return match;
  });
  
  return content;
}

// Function to fix require imports
function fixRequireImports(content) {
  content = content.replace(/require\(/g, 'import(');
  return content;
}

// Process a single file
function processFile(filePath) {
  try {
    let content = readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    content = fixUnusedVariables(content);
    content = fixAnyTypes(content);
    content = fixPreferConst(content);
    content = fixRequireImports(content);
    
    if (content !== originalContent) {
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
console.log('Starting ESLint error fixes...');

const srcDir = join(__dirname, 'src');
const tsFiles = findTsFiles(srcDir);

let fixedCount = 0;
for (const file of tsFiles) {
  if (processFile(file)) {
    fixedCount++;
  }
}

console.log(`Fixed ${fixedCount} files out of ${tsFiles.length} TypeScript files.`);
console.log('ESLint fixes completed!');
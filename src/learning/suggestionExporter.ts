/**
 * Suggestion Exporter
 * 
 * Exports learning suggestions to JSON file for human review.
 * Suggestions are NEVER automatically applied.
 * 
 * Requirement 11.1
 */

import { LearningSuggestion, SuggestionStatus } from './learningAdvisor';

/**
 * Export format for suggestions
 */
export interface SuggestionExport {
  exportedAt: string;
  version: string;
  totalSuggestions: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  suggestions: LearningSuggestion[];
}

/**
 * Export version for tracking format changes
 */
export const EXPORT_VERSION = '1.0.0';

/**
 * Format suggestions for export
 * 
 * @param suggestions - Array of suggestions to export
 * @returns Formatted export object
 */
export function formatSuggestionsForExport(
  suggestions: LearningSuggestion[]
): SuggestionExport {
  const pending = suggestions.filter(s => s.status === 'PENDING').length;
  const approved = suggestions.filter(s => s.status === 'APPROVED').length;
  const rejected = suggestions.filter(s => s.status === 'REJECTED').length;
  
  return {
    exportedAt: new Date().toISOString(),
    version: EXPORT_VERSION,
    totalSuggestions: suggestions.length,
    pendingCount: pending,
    approvedCount: approved,
    rejectedCount: rejected,
    suggestions: suggestions.sort((a, b) => b.createdAt - a.createdAt),
  };
}

/**
 * Serialize suggestions to JSON string
 * 
 * @param suggestions - Array of suggestions
 * @returns JSON string
 */
export function serializeSuggestions(suggestions: LearningSuggestion[]): string {
  const exportData = formatSuggestionsForExport(suggestions);
  return JSON.stringify(exportData, null, 2);
}

/**
 * Parse suggestions from JSON string
 * 
 * @param json - JSON string
 * @returns Parsed suggestions or null if invalid
 */
export function parseSuggestions(json: string): LearningSuggestion[] | null {
  try {
    const data = JSON.parse(json) as SuggestionExport;
    
    // Validate structure
    if (!data.suggestions || !Array.isArray(data.suggestions)) {
      return null;
    }
    
    // Validate each suggestion has required fields
    for (const suggestion of data.suggestions) {
      if (!suggestion.id || !suggestion.parameterType || 
          suggestion.currentValue === undefined || 
          suggestion.suggestedValue === undefined) {
        return null;
      }
    }
    
    return data.suggestions;
  } catch {
    return null;
  }
}

/**
 * Get default export filename
 * 
 * @returns Filename with timestamp
 */
export function getExportFilename(): string {
  const date = new Date().toISOString().split('T')[0];
  return `learning_suggestions_${date}.json`;
}

/**
 * Filter suggestions for export by status
 * 
 * @param suggestions - All suggestions
 * @param statuses - Statuses to include
 * @returns Filtered suggestions
 */
export function filterForExport(
  suggestions: LearningSuggestion[],
  statuses: SuggestionStatus[] = ['PENDING']
): LearningSuggestion[] {
  return suggestions.filter(s => statuses.includes(s.status));
}

/**
 * Create a summary of suggestions for display
 * 
 * @param suggestions - Array of suggestions
 * @returns Summary string
 */
export function createSuggestionSummary(suggestions: LearningSuggestion[]): string {
  if (suggestions.length === 0) {
    return 'No suggestions available.';
  }
  
  const pending = suggestions.filter(s => s.status === 'PENDING');
  const approved = suggestions.filter(s => s.status === 'APPROVED');
  const rejected = suggestions.filter(s => s.status === 'REJECTED');
  
  const lines: string[] = [
    `Total Suggestions: ${suggestions.length}`,
    `  Pending: ${pending.length}`,
    `  Approved: ${approved.length}`,
    `  Rejected: ${rejected.length}`,
    '',
  ];
  
  if (pending.length > 0) {
    lines.push('Pending Suggestions:');
    for (const s of pending.slice(0, 5)) {
      const direction = s.changePercent > 0 ? '+' : '';
      lines.push(`  - ${s.parameterType} for ${JSON.stringify(s.featureContext)}: ${direction}${s.changePercent}%`);
    }
    if (pending.length > 5) {
      lines.push(`  ... and ${pending.length - 5} more`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Validate suggestion bounds before export
 * Ensures all suggestions comply with +/- 15% limit
 * 
 * @param suggestions - Suggestions to validate
 * @returns Validation result
 */
export function validateSuggestionsForExport(
  suggestions: LearningSuggestion[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const s of suggestions) {
    if (Math.abs(s.changePercent) > 15) {
      errors.push(`Suggestion ${s.id} exceeds 15% change limit: ${s.changePercent}%`);
    }
    
    if (s.evidence.sampleSize < 30) {
      errors.push(`Suggestion ${s.id} has insufficient sample size: ${s.evidence.sampleSize}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

import { validateBusinessRecord } from './parser/validator';
import { tokenize } from './parser/lexer';
import { parse } from './parser/parser';
import type { ValidationResult } from './parser/types';

export const ImportService = {
  /**
   * Orchestrates the import of a Business Record.
   * Runs envelope validation, tokenizes, and parses content into an AST.
   */
  async importRecord(rawContent: string, filename: string): Promise<ValidationResult> {
    // Normalize away em dashes (and en dashes) on the way in, so no uploaded or
    // AI-generated markdown can ever put one on a slide. Replaced with a hyphen.
    const content = rawContent.replace(/[\u2013\u2014]/g, '-');
    return new Promise((resolve) => {
      // Simulate light parser latency for premium UI states (e.g., validations/checklists)
      setTimeout(() => {
        const result = validateBusinessRecord(content, filename);
        
        if (result.isValid) {
          try {
            const tokens = tokenize(content);
            const ast = parse(tokens);
            result.ast = ast;
          } catch (err) {
            result.isValid = false;
            result.errors.push({
              severity: 'error',
              title: 'AST Parsing Failed',
              explanation: `An unexpected parser error occurred during token extraction or node grouping: ${
                err instanceof Error ? err.message : String(err)
              }`,
              line: 1,
            });
          }
        }
        
        resolve(result);
      }, 400);
    });
  },
};

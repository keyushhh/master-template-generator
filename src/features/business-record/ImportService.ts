import { validateBusinessRecord } from './parser/validator';
import { tokenize } from './parser/lexer';
import { parse } from './parser/parser';
import type { ValidationResult } from './parser/types';

export const ImportService = {
  /**
   * Orchestrates the import of a Business Record.
   * Runs envelope validation, tokenizes, and parses content into an AST.
   */
  async importRecord(content: string, filename: string): Promise<ValidationResult> {
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

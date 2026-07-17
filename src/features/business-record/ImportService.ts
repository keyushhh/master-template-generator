import { validateBusinessRecord } from './parser/validator';
import type { ValidationResult } from './parser/types';

export const ImportService = {
  /**
   * Orchestrates the import of a Business Record.
   * Runs lightweight envelope validation.
   */
  async importRecord(content: string, filename: string): Promise<ValidationResult> {
    return new Promise((resolve) => {
      // Simulate light parser latency for premium UI states (e.g., validations/checklists)
      setTimeout(() => {
        const result = validateBusinessRecord(content, filename);
        resolve(result);
      }, 400);
    });
  },
};

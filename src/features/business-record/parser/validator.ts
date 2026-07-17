import { REQUIRED_METADATA_KEYS } from './schema';
import type { ValidationResult, ValidationError } from './types';

export function validateBusinessRecord(content: string, filename: string): ValidationResult {
  const errors: ValidationError[] = [];
  const metadata: Record<string, string> = {};

  // Check if content is empty
  if (!content || content.trim() === '') {
    return {
      isValid: false,
      errors: [
        {
          severity: 'error',
          title: 'Empty File',
          explanation: `The file "${filename}" contains no content. Please upload a valid markdown document.`,
          line: 1,
        },
      ],
    };
  }

  const lines = content.split('\n');

  // Verify file format / starts with expected block ---
  if (!lines[0].startsWith('---')) {
    errors.push({
      severity: 'error',
      title: 'Missing YAML Frontmatter Block',
      explanation: 'The Business Record must begin with a YAML frontmatter block enclosed by three dashes (---) on the first line.',
      line: 1,
    });
    return { isValid: false, errors };
  }

  // Find the closing --- boundary
  let closingIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      closingIndex = i;
      break;
    }
  }

  if (closingIndex === -1) {
    errors.push({
      severity: 'error',
      title: 'Malformed YAML Frontmatter Block',
      explanation: 'Could not find the closing frontmatter boundary (---). Ensure your metadata block is properly closed.',
      line: 1,
    });
    return { isValid: false, errors };
  }

  // Parse frontmatter keys
  const parsedKeys = new Set<string>();
  for (let i = 1; i < closingIndex; i++) {
    const lineContent = lines[i].trim();
    if (lineContent === '' || lineContent.startsWith('#')) {
      continue; // Skip comments and empty lines
    }

    const colonIndex = lineContent.indexOf(':');
    if (colonIndex === -1) {
      errors.push({
        severity: 'warning',
        title: 'Malformed Frontmatter Property',
        explanation: `Expected "key: value" format. Found: "${lineContent}"`,
        line: i + 1,
      });
      continue;
    }

    const key = lineContent.substring(0, colonIndex).trim();
    // Strip quotes from value if present
    const rawVal = lineContent.substring(colonIndex + 1).trim();
    const value = rawVal.replace(/^["']|["']$/g, '');

    if (!key) {
      errors.push({
        severity: 'warning',
        title: 'Empty Frontmatter Key',
        explanation: 'A frontmatter property has an empty key.',
        line: i + 1,
      });
      continue;
    }

    metadata[key] = value;
    parsedKeys.add(key);
  }

  // Check for required metadata keys
  for (const key of REQUIRED_METADATA_KEYS) {
    if (!parsedKeys.has(key) || !metadata[key] || metadata[key].trim() === '') {
      errors.push({
        severity: 'error',
        title: `Missing Required Metadata: "${key}"`,
        explanation: `The metadata property "${key}" is required for the Business Record envelope. Ensure it is defined in the frontmatter block.`,
        line: 1, // Indicate at the top of the block
      });
    }
  }

  const isValid = !errors.some((err) => err.severity === 'error');

  return {
    isValid,
    errors,
    metadata: isValid ? metadata : undefined,
  };
}

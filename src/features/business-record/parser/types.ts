export interface ValidationError {
  severity: 'error' | 'warning';
  title: string;
  explanation: string;
  line?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  metadata?: Record<string, string>;
}

export const REQUIRED_METADATA_KEYS = ['version', 'type', 'client', 'title'] as const;

export type RequiredMetadataKey = typeof REQUIRED_METADATA_KEYS[number];

/**
 * Recognized optional metadata keys. Unlike REQUIRED_METADATA_KEYS, the
 * parser accepts any key generically - this list just documents keys that
 * the Presentation Compiler looks for by name (e.g. `logo` is read by the
 * slide Logo component in PresentationCanvas.tsx).
 */
export const OPTIONAL_METADATA_KEYS = ['logo'] as const;

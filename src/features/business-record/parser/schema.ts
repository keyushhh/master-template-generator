export const REQUIRED_METADATA_KEYS = ['version', 'type', 'client', 'title'] as const;

export type RequiredMetadataKey = typeof REQUIRED_METADATA_KEYS[number];

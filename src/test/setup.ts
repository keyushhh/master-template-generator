import { beforeEach } from 'vitest';
import { installMemoryStorage } from './localStorage';

// Every test starts with an empty store, so an earlier test's decks can never
// decide a later one's result.
beforeEach(() => installMemoryStorage());

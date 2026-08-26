import { describe, it, expect, vi, afterEach } from 'vitest';
import { relativeTime } from './relativeTime';

const NOW = new Date('2026-08-26T12:00:00Z').getTime();
const ago = (ms: number) => NOW - ms;
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

afterEach(() => vi.useRealTimers());

function at(now: number) {
  vi.useFakeTimers();
  vi.setSystemTime(now);
}

describe('relativeTime', () => {
  it('reads as relative while that is the more useful reading', () => {
    at(NOW);
    expect(relativeTime(ago(10_000))).toBe('Just now');
    expect(relativeTime(ago(4 * MIN))).toBe('4 min ago');
    expect(relativeTime(ago(1 * HOUR))).toBe('1 hour ago');
    expect(relativeTime(ago(5 * HOUR))).toBe('5 hours ago');
    expect(relativeTime(ago(1 * DAY))).toBe('Yesterday');
    expect(relativeTime(ago(3 * DAY))).toBe('3 days ago');
  });

  it('switches to a date once counting days stops helping', () => {
    at(NOW);
    // A week out, the reader wants a date rather than arithmetic.
    expect(relativeTime(ago(9 * DAY))).not.toMatch(/ago/);
  });

  it('adds the year only once the date would be ambiguous without it', () => {
    at(NOW);
    expect(relativeTime(ago(20 * DAY))).not.toMatch(/20\d\d/);
    expect(relativeTime(ago(400 * DAY))).toMatch(/20\d\d/);
  });

  it('does not read as being in the future for a clock that is slightly behind', () => {
    at(NOW);
    expect(relativeTime(NOW + 30_000)).toBe('Just now');
  });

  it('says hour, not hours, exactly once', () => {
    at(NOW);
    expect(relativeTime(ago(HOUR + 5 * MIN))).toBe('1 hour ago');
    expect(relativeTime(ago(2 * HOUR))).toBe('2 hours ago');
  });
});

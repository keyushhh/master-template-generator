/**
 * "4 min ago" / "Yesterday" / "12 Aug".
 *
 * Relative while that is the more useful reading, absolute once it stops being:
 * "34 days ago" is arithmetic the reader has to do, and a year only earns its
 * place once the date is old enough to be ambiguous without it.
 *
 * Shared by the library's hero, table and grid so all three phrase a date the
 * same way.
 */
export function relativeTime(ts: number): string {
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(days > 300 ? { year: 'numeric' } : {}),
  });
}

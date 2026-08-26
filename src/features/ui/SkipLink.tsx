/** Invisible until focused, then the first stop for a keyboard user: a way
 *  past the top bar and rails straight to the slide or the library grid,
 *  without tabbing through every control in between. */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      style={{
        position: 'fixed',
        top: -60,
        left: 8,
        zIndex: 1000,
        padding: '10px 16px',
        background: 'var(--neutral-900)',
        color: '#fff',
        fontSize: 13,
        fontWeight: 700,
        borderRadius: 'var(--radius-sharp)',
        transition: 'top .15s ease',
      }}
      onFocus={(e) => { e.currentTarget.style.top = '8px'; }}
      onBlur={(e) => { e.currentTarget.style.top = '-60px'; }}
    >
      Skip to content
    </a>
  );
}

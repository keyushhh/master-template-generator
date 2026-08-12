import { useEffect, useState } from 'react';
import { ArrowUpIcon } from './icons';

/** How far down the page the button appears. Roughly one screenful, so it never
 *  shows up while the top of the page is still in view. */
const SHOW_AFTER = 720;

/**
 * Back to the top, for pages that can get long.
 *
 * Only present once scrolling has actually taken you somewhere, because a control
 * for returning to a place you can already see is just another button. Sits
 * bottom-right; the dev state simulator was moved to bottom-left to leave this
 * corner free in every build.
 */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER);
    onScroll();
    // Passive: this only reads scroll position, so it must never delay the scroll
    // itself.
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      title="Back to top"
      // Kept mounted and faded rather than unmounted, so it eases in and out
      // instead of appearing mid-scroll with a snap.
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className="fixed bottom-6 right-6 z-[120] flex items-center gap-2 h-[38px] px-3.5 bg-neutral-900 text-white text-[12px] font-bold hover:bg-neutral-800 cursor-pointer"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(10px)',
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity .2s ease, transform .2s ease, background-color .15s ease',
        boxShadow: '0 10px 30px -10px rgba(15,23,20,0.45)',
      }}
    >
      <ArrowUpIcon size={13} />
      Top
    </button>
  );
}

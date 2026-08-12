import { useEffect } from 'react';
import { getFitOutline, setFitOutline } from './fitStore';

/**
 * Cmd/Ctrl + Shift + F toggles the fit outlines, anywhere in the app.
 *
 * The state simulator carries the same switch, but it only exists on the
 * library - and the slides being checked are in the studio, which would mean
 * toggling it on one screen to see it on another. A key does not care which
 * screen you are on.
 *
 * Dev builds only; the whole component is dropped from a production bundle.
 */
export function FitDevShortcut() {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        // Read the store rather than a local flag, so this and the simulator's
        // button are the same switch instead of two that fight each other.
        setFitOutline(!getFitOutline());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return null;
}

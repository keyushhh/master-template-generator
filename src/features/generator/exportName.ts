/**
 * The filename an export lands under.
 *
 * Its own module because two places need it and neither can import the other:
 * `exportHelper` pulls in pptxgenjs, jsPDF and html2canvas (~900kB) and is
 * lazily loaded for that reason, while the export sheet has to show the name
 * before any of that is downloaded. It used to be copied into both, with a
 * comment asking future readers to keep them in step.
 */
export function sanitizeFileName(name: string): string {
  // Runs of separators collapse and the ends are trimmed, so "UX Journey &
  // Flow" is ux-journey-flow rather than ux_journey___flow.
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'presentation'
  );
}

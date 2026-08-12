/**
 * Prints a hash of every slide's XML from a real export of the pristine master
 * template. A pure refactor of the exporter must not change a single line here.
 *
 *   node scripts/pptx-snapshot.mjs > /tmp/baseline.txt   # before a change
 *   node scripts/pptx-snapshot.mjs > /tmp/after.txt      # after it
 *   diff /tmp/baseline.txt /tmp/after.txt                # must be empty
 */

import { createHash } from 'node:crypto';
import { installBrowserStubs, loadExporter, renderSlideXml } from './_pptx-harness.mjs';

installBrowserStubs();
const rig = await loadExporter();
const slides = await renderSlideXml(rig, undefined);

console.log(`slides: ${slides.length}`);
for (const { name, xml } of slides) {
  const hash = createHash('sha256').update(xml).digest('hex').slice(0, 16);
  console.log(`${name}\t${hash}\t${xml.length} bytes`);
}

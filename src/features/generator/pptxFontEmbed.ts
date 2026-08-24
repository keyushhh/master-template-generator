import JSZip from 'jszip';
import { fileUrl, fontByFamily, loadCatalog } from '../fonts/fontCatalog';

interface FontManifestEntry {
  typeface: string;
  regularUrl: string;
  boldUrl: string;
  /** True when both URLs point at the same variable file. */
  variable?: boolean;
}

/**
 * Static instances (regular + bold) of every typeface the deck renderer uses
 * (see the `fonts` block of each theme in features/theme/deckTheme.ts), served
 * from /public so they can be fetched client-side at export time. pptxgenjs has
 * no font embedding support of its own - it only writes the font *name* into the
 * XML - so without this, PowerPoint falls back to a substitute on any machine
 * that does not happen to have the family installed.
 *
 * This list has to cover all three roles. It carried only display and mono for a
 * while, which is exactly why the old body face substituted in every export: it
 * was named in the XML with no file behind it, so the deck looked right in the
 * studio and wrong the moment a client opened it.
 */

/**
 * Where the bytes for one family come from.
 *
 * The three house faces are local static instances, which is the best case: one
 * real file per weight, no network, no licence question. Anything else the user
 * has picked is a Google Font, and its files come from the google/fonts
 * repository through jsDelivr - the only source that is both CORS-readable from a
 * page and carries redistributable licences.
 *
 * `fonts.gstatic.com` would be better (Google generates proper static instances
 * per weight) but it only reveals those URLs to a non-browser User-Agent, and a
 * page cannot claim to be one.
 *
 * Returns null for a family we have no file for at all, which is a real case: a
 * deck imported from a .pptx can name any font its original author had installed.
 * The caller reports those rather than failing the export, because a deck that
 * will substitute one label's font is still a deck worth sending.
 */
function resolveFamily(family: string): FontManifestEntry | null {
  const house = FONT_MANIFEST.find((f) => f.typeface === family);
  if (house) return house;

  const font = fontByFamily(family);
  if (!font) return null;
  return {
    typeface: family,
    regularUrl: fileUrl(font, 'regular'),
    boldUrl: fileUrl(font, 'bold'),
    // A variable file has one outline for every weight. PowerPoint draws it at
    // its default instance, so bold text gets synthesised rather than drawn -
    // still far better than the whole family being substituted.
    variable: font.variable,
  };
}

export interface FontEmbedReport {
  /** Families whose outlines are inside the file. */
  embedded: string[];
  /** Families named in the XML with no outlines behind them, so PowerPoint will
   *  substitute. Google Slides still resolves these by name. */
  named: string[];
  /** Embedded from a variable file, so PowerPoint fakes the bold. */
  approximate: string[];
}

const FONT_MANIFEST: FontManifestEntry[] = [
  { typeface: 'Space Grotesk', regularUrl: '/fonts/SpaceGrotesk-Regular.ttf', boldUrl: '/fonts/SpaceGrotesk-Bold.ttf' },
  { typeface: 'DM Sans', regularUrl: '/fonts/DMSans-Regular.ttf', boldUrl: '/fonts/DMSans-Bold.ttf' },
  { typeface: 'JetBrains Mono', regularUrl: '/fonts/JetBrainsMono-Regular.ttf', boldUrl: '/fonts/JetBrainsMono-Bold.ttf' },
];

// PowerPoint's embedded-font parts (.fntdata) obfuscate the first two 16-byte
// blocks of the TrueType file by XORing them against the part's own GUID
// filename, with the GUID's bytes read back in this order. This is the same
// ODTTF scheme XPS uses (ports Okular's XpsFile::loadFontByName /
// parseGUID - see generators/xps/generator_xps.cpp) - PPTX just has no
// separate fontKey attribute, so the filename IS the key.
const OBFUSCATION_MAP = [15, 14, 13, 12, 11, 10, 9, 8, 6, 7, 4, 5, 0, 1, 2, 3];

function randomGuidKey(): Uint8Array {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** Renders a 16-byte key as the dashed hex GUID string PowerPoint's parser expects as a filename. */
function guidKeyToFileName(guid: Uint8Array): string {
  const hex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  const seg = (idxs: number[]) => idxs.map((i) => hex(guid[i])).join('');
  return `${seg([3, 2, 1, 0])}-${seg([5, 4])}-${seg([7, 6])}-${seg([8, 9])}-${seg([10, 11, 12, 13, 14, 15])}`;
}

/** XOR is its own inverse, so this same transform both obfuscates (here) and de-obfuscates (in the reader). */
function obfuscateFontData(data: ArrayBuffer, guid: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(data.slice(0));
  for (let i = 0; i < 16; i++) {
    const keyByte = guid[OBFUSCATION_MAP[i]];
    bytes[i] ^= keyByte;
    bytes[i + 16] ^= keyByte;
  }
  return bytes;
}

async function fetchFont(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch font asset: ${url} (${res.status})`);
  return res.arrayBuffer();
}

function nextRelIds(relsXml: string, count: number): string[] {
  const used = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((m) => parseInt(m[1], 10));
  const start = (used.length ? Math.max(...used) : 0) + 1;
  return Array.from({ length: count }, (_, i) => `rId${start + i}`);
}

/**
 * Post-processes a pptxgenjs-generated .pptx (as returned by
 * `pptx.write({ outputType: 'arraybuffer' })`) to embed the real Space
 * Grotesk / JetBrains Mono font files, so the export renders with the
 * intended typefaces even on machines that don't have them installed.
 *
 * Falls back to returning the buffer untouched if the pptx doesn't have the
 * expected part layout, or if a font asset fails to fetch - a missing
 * embedded font is a cosmetic regression, not a reason to fail the export.
 */
export async function embedPptxFonts(
  pptxBuffer: ArrayBuffer,
  /** Every family named anywhere in this deck. Defaults to the house three, which
   *  is what a caller with no deck in scope should embed. */
  families: readonly string[] = FONT_MANIFEST.map((f) => f.typeface)
): Promise<{ buffer: ArrayBuffer; report: FontEmbedReport }> {
  const report: FontEmbedReport = { embedded: [], named: [], approximate: [] };
  const zip = await JSZip.loadAsync(pptxBuffer);

  // Needed to resolve anything outside the house three. If it cannot be read we
  // still embed the local files rather than giving up on all of them.
  if (families.some((f) => !FONT_MANIFEST.some((h) => h.typeface === f))) {
    try {
      await loadCatalog();
    } catch {
      /* resolveFamily will return null and those families land in `named`. */
    }
  }

  const targets: FontManifestEntry[] = [];
  for (const family of new Set(families)) {
    const entry = resolveFamily(family);
    if (entry) targets.push(entry);
    else report.named.push(family);
  }

  const presentationFile = zip.file('ppt/presentation.xml');
  const relsFile = zip.file('ppt/_rels/presentation.xml.rels');
  const contentTypesFile = zip.file('[Content_Types].xml');
  if (!presentationFile || !relsFile || !contentTypesFile) {
    return { buffer: pptxBuffer, report: { ...report, named: [...report.named, ...targets.map((t) => t.typeface)] } };
  }

  let presentationXml = await presentationFile.async('string');
  let relsXml = await relsFile.async('string');
  let contentTypesXml = await contentTypesFile.async('string');

  const relIds = nextRelIds(relsXml, targets.length * 2);
  let relIdCursor = 0;
  const embeddedFontEntries: string[] = [];
  const newRelationships: string[] = [];

  for (const font of targets) {
    // One family failing to download must not take the rest with it. A CDN 404 on
    // an obscure face should cost that face's outlines, not the whole export.
    let regularBuf: ArrayBuffer;
    let boldBuf: ArrayBuffer;
    try {
      [regularBuf, boldBuf] = await Promise.all([fetchFont(font.regularUrl), fetchFont(font.boldUrl)]);
    } catch (err) {
      console.warn(`Could not fetch ${font.typeface} for embedding:`, err);
      report.named.push(font.typeface);
      continue;
    }

    const regularGuid = randomGuidKey();
    const boldGuid = randomGuidKey();
    const regularFileName = guidKeyToFileName(regularGuid);
    const boldFileName = guidKeyToFileName(boldGuid);
    const regularData = obfuscateFontData(regularBuf, regularGuid);
    const boldData = obfuscateFontData(boldBuf, boldGuid);

    const regularRid = relIds[relIdCursor++];
    const boldRid = relIds[relIdCursor++];

    zip.file(`ppt/fonts/${regularFileName}.fntdata`, regularData);
    zip.file(`ppt/fonts/${boldFileName}.fntdata`, boldData);

    newRelationships.push(
      `<Relationship Id="${regularRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/${regularFileName}.fntdata"/>`,
      `<Relationship Id="${boldRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/${boldFileName}.fntdata"/>`
    );
    embeddedFontEntries.push(
      `<p:embeddedFont><p:font typeface="${escapeXml(font.typeface)}"/><p:regular r:id="${regularRid}"/><p:bold r:id="${boldRid}"/></p:embeddedFont>`
    );
    report.embedded.push(font.typeface);
    if (font.variable) report.approximate.push(font.typeface);
  }

  // Nothing downloaded: leave the package exactly as it came in rather than
  // writing an empty embeddedFontLst, which some readers treat as malformed.
  if (embeddedFontEntries.length === 0) {
    return { buffer: pptxBuffer, report };
  }

  relsXml = relsXml.replace('</Relationships>', `${newRelationships.join('')}</Relationships>`);

  if (!/Extension="fntdata"/.test(contentTypesXml)) {
    contentTypesXml = contentTypesXml.replace(
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="fntdata" ContentType="application/x-fontdata"/>'
    );
  }

  // embedTrueTypeFonts must be set for PowerPoint to look at embeddedFontLst at all.
  presentationXml = presentationXml.replace(/<p:presentation\b/, '<p:presentation embedTrueTypeFonts="1"');
  // Per CT_Presentation's schema order, embeddedFontLst goes right after notesSz.
  presentationXml = presentationXml.replace(
    /(<p:notesSz[^>]*\/>)/,
    `$1<p:embeddedFontLst>${embeddedFontEntries.join('')}</p:embeddedFontLst>`
  );

  zip.file('ppt/presentation.xml', presentationXml);
  zip.file('ppt/_rels/presentation.xml.rels', relsXml);
  zip.file('[Content_Types].xml', contentTypesXml);

  return { buffer: await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' }), report };
}

/** Family names reach the XML verbatim, and a catalogue name can contain an
 *  ampersand. Unescaped, that is a malformed presentation.xml and PowerPoint
 *  refuses the whole file. */
function escapeXml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

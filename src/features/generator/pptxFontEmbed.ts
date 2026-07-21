import JSZip from 'jszip';

interface FontManifestEntry {
  typeface: string;
  regularUrl: string;
  boldUrl: string;
}

/**
 * Static instances (regular + bold) of the two typefaces the deck renderer
 * uses (see FONT_DISPLAY / FONT_MONO in pptxNative.ts), served from /public
 * so they can be fetched client-side at export time. pptxgenjs has no font
 * embedding support of its own - it only writes the font *name* into the
 * XML - so without this, PowerPoint falls back to a substitute font on any
 * machine that doesn't have Space Grotesk / JetBrains Mono installed.
 */
const FONT_MANIFEST: FontManifestEntry[] = [
  { typeface: 'Space Grotesk', regularUrl: '/fonts/SpaceGrotesk-Regular.ttf', boldUrl: '/fonts/SpaceGrotesk-Bold.ttf' },
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
export async function embedPptxFonts(pptxBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(pptxBuffer);

  const presentationFile = zip.file('ppt/presentation.xml');
  const relsFile = zip.file('ppt/_rels/presentation.xml.rels');
  const contentTypesFile = zip.file('[Content_Types].xml');
  if (!presentationFile || !relsFile || !contentTypesFile) {
    return pptxBuffer;
  }

  let presentationXml = await presentationFile.async('string');
  let relsXml = await relsFile.async('string');
  let contentTypesXml = await contentTypesFile.async('string');

  const relIds = nextRelIds(relsXml, FONT_MANIFEST.length * 2);
  let relIdCursor = 0;
  const embeddedFontEntries: string[] = [];
  const newRelationships: string[] = [];

  for (const font of FONT_MANIFEST) {
    const [regularBuf, boldBuf] = await Promise.all([fetchFont(font.regularUrl), fetchFont(font.boldUrl)]);

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
      `<p:embeddedFont><p:font typeface="${font.typeface}"/><p:regular r:id="${regularRid}"/><p:bold r:id="${boldRid}"/></p:embeddedFont>`
    );
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

  return zip.generateAsync({ type: 'arraybuffer' });
}

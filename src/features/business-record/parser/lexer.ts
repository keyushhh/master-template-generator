import type { Token } from './tokens';

export function tokenize(content: string): Token[] {
  const tokens: Token[] = [];
  const lines = content.split('\n');
  let i = 0;

  // 1. Parse Frontmatter
  if (lines.length > 0 && lines[0].trim() === '---') {
    let frontmatterValue = '';
    const frontmatterStartLine = 1;
    let foundClosing = false;
    i = 1;
    while (i < lines.length) {
      if (lines[i].trim() === '---') {
        foundClosing = true;
        i++;
        break;
      }
      frontmatterValue += lines[i] + '\n';
      i++;
    }
    // If not found closing ---, treat the rest of the document as frontmatter
    tokens.push({
      type: 'FRONTMATTER',
      value: frontmatterValue.trim(),
      line: frontmatterStartLine,
    });
  }

  // 2. Parse remaining lines
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === '') {
      i++;
      continue;
    }

    const startLineNum = i + 1;

    // A. Fenced Code Block
    if (trimmed.startsWith('```')) {
      let codeContent = line + '\n';
      i++;
      while (i < lines.length) {
        codeContent += lines[i] + '\n';
        if (lines[i].trim().startsWith('```')) {
          i++;
          break;
        }
        i++;
      }
      tokens.push({
        type: 'UNSUPPORTED',
        value: codeContent.trim(),
        line: startLineNum,
        unsupportedKind: 'code-block',
      });
      continue;
    }

    // B. Table
    if (trimmed.startsWith('|')) {
      let tableContent = '';
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableContent += lines[i] + '\n';
        i++;
      }
      tokens.push({
        type: 'UNSUPPORTED',
        value: tableContent.trim(),
        line: startLineNum,
        unsupportedKind: 'table',
      });
      continue;
    }

    // C. Blockquote
    if (trimmed.startsWith('>')) {
      let quoteContent = '';
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteContent += lines[i] + '\n';
        i++;
      }
      tokens.push({
        type: 'UNSUPPORTED',
        value: quoteContent.trim(),
        line: startLineNum,
        unsupportedKind: 'blockquote',
      });
      continue;
    }

    // D. HTML block
    if (trimmed.startsWith('<')) {
      let htmlContent = '';
      while (i < lines.length && lines[i].trim().startsWith('<')) {
        htmlContent += lines[i] + '\n';
        i++;
      }
      tokens.push({
        type: 'UNSUPPORTED',
        value: htmlContent.trim(),
        line: startLineNum,
        unsupportedKind: 'html',
      });
      continue;
    }

    // E. Image block
    if (trimmed.startsWith('![')) {
      tokens.push({
        type: 'UNSUPPORTED',
        value: trimmed,
        line: startLineNum,
        unsupportedKind: 'image',
      });
      i++;
      continue;
    }

    // F. Headings
    if (trimmed.startsWith('## ')) {
      tokens.push({
        type: 'HEADING_2',
        value: trimmed.substring(3).trim(),
        line: startLineNum,
      });
      i++;
      continue;
    }

    if (trimmed.startsWith('# ')) {
      tokens.push({
        type: 'HEADING_1',
        value: trimmed.substring(2).trim(),
        line: startLineNum,
      });
      i++;
      continue;
    }

    // G. Bullet List Items
    if (/^[*\-+] /.test(trimmed)) {
      tokens.push({
        type: 'BULLET_ITEM',
        value: trimmed.substring(2).trim(),
        line: startLineNum,
      });
      i++;
      continue;
    }

    // H. Paragraph (accumulate consecutive text lines)
    let paragraphContent = line + '\n';
    i++;
    while (i < lines.length) {
      const nextLine = lines[i];
      const nextTrimmed = nextLine.trim();
      
      // Stop condition for paragraph
      if (
        nextTrimmed === '' ||
        nextTrimmed.startsWith('```') ||
        nextTrimmed.startsWith('|') ||
        nextTrimmed.startsWith('>') ||
        nextTrimmed.startsWith('<') ||
        nextTrimmed.startsWith('![') ||
        nextTrimmed.startsWith('#') ||
        /^[*\-+] /.test(nextTrimmed)
      ) {
        break;
      }

      paragraphContent += nextLine + '\n';
      i++;
    }

    tokens.push({
      type: 'PARAGRAPH',
      value: paragraphContent.trim(),
      line: startLineNum,
    });
  }

  // Append EOF
  tokens.push({
    type: 'EOF',
    value: '',
    line: lines.length + 1,
  });

  return tokens;
}

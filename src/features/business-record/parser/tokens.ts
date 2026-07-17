export type TokenType =
  | 'FRONTMATTER'
  | 'HEADING_1'
  | 'HEADING_2'
  | 'BULLET_ITEM'
  | 'PARAGRAPH'
  | 'UNSUPPORTED'
  | 'EOF';

export type UnsupportedKind = 'table' | 'code-block' | 'blockquote' | 'image' | 'html';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  unsupportedKind?: UnsupportedKind;
}

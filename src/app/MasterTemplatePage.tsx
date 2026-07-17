import { GeneratorSidebar } from '../features/generator/GeneratorSidebar';
import { PresentationCanvas } from '../features/generator/PresentationCanvas';
import { useState } from 'react';
import type { DocumentNode } from '../features/business-record/parser/ast';

export function MasterTemplatePage() {
  const [ast, setAst] = useState<DocumentNode | null>(null);

  return (
    <div className="wg-doc">
      <GeneratorSidebar hasPresentation={!!ast} onDocumentParsed={setAst} />
      <PresentationCanvas ast={ast} />
    </div>
  );
}

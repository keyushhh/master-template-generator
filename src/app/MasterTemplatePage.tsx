import { useCallback, useEffect, useState } from 'react';
import { GeneratorSidebar } from '../features/generator/GeneratorSidebar';
import { PresentationCanvas } from '../features/generator/PresentationCanvas';
import type { DocumentNode } from '../features/business-record/parser/ast';
import type { Deck } from '../features/deck/types';
import {
  createTemplateDeck,
  buildDeckFromDocument,
  mintInstanceId,
} from '../features/deck/deckBuilder';

const STORAGE_KEY = 'wozku-master-template-session-v1';

interface PersistedSession {
  ast: DocumentNode | null;
  deck: Deck;
}

function loadSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    if (!parsed.deck || !Array.isArray(parsed.deck.slides)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function MasterTemplatePage() {
  const [ast, setAst] = useState<DocumentNode | null>(() => loadSession()?.ast ?? null);
  const [deck, setDeck] = useState<Deck>(() => loadSession()?.deck ?? createTemplateDeck());

  // Persist the working session so a refresh doesn't lose the generated deck.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ast, deck }));
    } catch {
      // Storage may be unavailable (private mode / quota) — non-fatal.
    }
  }, [ast, deck]);

  const handleGenerate = useCallback(() => {
    if (!ast) return;
    setDeck(buildDeckFromDocument(ast));
  }, [ast]);

  const handleToggleHidden = useCallback((instanceId: string) => {
    setDeck((prev) => ({
      ...prev,
      slides: prev.slides.map((s) =>
        s.instanceId === instanceId ? { ...s, hidden: !s.hidden } : s
      ),
    }));
  }, []);

  const handleDuplicate = useCallback((instanceId: string) => {
    setDeck((prev) => {
      const index = prev.slides.findIndex((s) => s.instanceId === instanceId);
      if (index === -1) return prev;
      const source = prev.slides[index];
      const copy = {
        ...source,
        instanceId: mintInstanceId(source.templateId),
        title: `${source.title} (Copy)`,
        hidden: false,
        content: { ...source.content },
      };
      const slides = [...prev.slides];
      slides.splice(index + 1, 0, copy);
      return { ...prev, slides };
    });
  }, []);

  const handleDelete = useCallback((instanceId: string) => {
    setDeck((prev) => ({
      ...prev,
      slides: prev.slides.filter((s) => s.instanceId !== instanceId),
    }));
  }, []);

  return (
    <div className="wg-doc">
      <GeneratorSidebar
        hasPresentation={!!ast}
        deck={deck}
        onDocumentParsed={setAst}
        onGenerate={handleGenerate}
        onToggleHidden={handleToggleHidden}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
      />
      <PresentationCanvas ast={ast} deck={deck} />
    </div>
  );
}

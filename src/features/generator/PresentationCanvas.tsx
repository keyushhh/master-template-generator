import type { DocumentNode } from '../business-record/parser/ast';

interface PresentationCanvasProps {
  ast: DocumentNode | null;
}

const slides = [
  { id: 'cover', title: '01 Cover' },
  { id: 'summary', title: '02 Executive Summary' },
  { id: 'campaign', title: '03 Campaign Overview' },
  { id: 'metrics', title: '04 Key Metrics' },
  { id: 'advocates', title: '05 Advocates' },
  { id: 'results', title: '06 Results' },
  { id: 'roi', title: '07 ROI' },
  { id: 'closing', title: '08 Closing' },
];

export function PresentationCanvas({ ast }: PresentationCanvasProps) {
  return (
    <div className="book">
      {slides.map((slide, i) => (
        <div key={slide.id} id={slide.id} className="page flex flex-col justify-center items-center text-center">
          <div className="eyebrow absolute top-16 left-16">
            WOZKU MASTER TEMPLATE
          </div>
          
          <div className="text-center">
            <h1 className="page-title">
              {ast ? `${slide.title} (Populated)` : slide.title}
            </h1>
            <p className="page-body">
              {ast 
                ? 'This content was generated from your uploaded Document. You can see the actual ast content would go here.'
                : 'Placeholder content for the Wozku Master Template. This section will automatically populate once a Document is provided.'}
            </p>
          </div>
          
          <div className="footer-row">
            <span>{slide.title}</span>
            <span>{i + 1} / {slides.length}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

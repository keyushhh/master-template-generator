/**
 * The small panel behind a chart's "Data" button: lets the user rename
 * categories, edit series values, and add/remove rows or series.
 *
 * Deliberately not a Menu (formatting's usual dropdown) - it needs to sit
 * open next to the toolbar while the user edits several fields in a row, and
 * a Menu closes on outside click, which would fight typing into its own
 * inputs the moment the pointer left the input's own box.
 */

import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { OverlayChartSeries, OverlayChartType } from '../deck/types';
import { withCategory, withSeries } from './chartData';
import { CHART_SLOT_LABELS, chartColorsFor, cssHex, themeChartPalette, withChartColor } from './chartPalette';
import { WOZKU_THEME, type DeckTheme } from '../theme/deckTheme';
import { normalizeHex } from './rails';

const mono: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10,
  textTransform: 'uppercase', letterSpacing: '0.12em',
};

const cellInput: React.CSSProperties = {
  width: '100%', height: 26, padding: '0 6px', boxSizing: 'border-box',
  fontFamily: 'var(--font-sans)', fontSize: 12,
  color: '#fff', background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 'var(--radius-sharp)',
};

const iconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 22, height: 22, padding: 0,
  border: '1px solid rgba(255,255,255,0.18)', background: 'transparent',
  color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
  borderRadius: 'var(--radius-sharp)', fontSize: 13, lineHeight: 1,
};

interface ChartDataEditorProps {
  chartType: OverlayChartType;
  categories: string[];
  series: OverlayChartSeries[];
  onChange: (next: { categories: string[]; series: OverlayChartSeries[] }) => void;
  onClose: () => void;
  /** The deck's theme, which is where a chart's colours come from. */
  theme?: DeckTheme;
  /** Per-index colour overrides currently on the shape. */
  colors?: string[];
  onColorsChange: (colors: string[] | undefined) => void;
}

function parseCSV(csvText: string): { categories: string[]; series: OverlayChartSeries[] } | null {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const rows = lines.map((l) => l.split(delimiter).map((cell) => cell.trim().replace(/^["']|["']$/g, '')));
  const header = rows[0];
  if (header.length < 2) return null;
  const seriesNames = header.slice(1);
  const categories: string[] = [];
  const seriesValues: number[][] = seriesNames.map(() => []);
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row.length) continue;
    categories.push(row[0] || `Row ${i}`);
    for (let s = 0; s < seriesNames.length; s++) {
      const val = parseFloat(row[s + 1] || '0');
      seriesValues[s].push(Number.isFinite(val) ? val : 0);
    }
  }
  const series: OverlayChartSeries[] = seriesNames.map((name, s) => ({
    name: name || `Series ${s + 1}`,
    values: seriesValues[s],
  }));
  return { categories, series };
}

/**
 * The colour of one series, or of one pie slice.
 *
 * A chart's colours come from the deck's theme, and that is the answer almost
 * every time: it is what keeps a client's deck in the client's colours. This is
 * the escape hatch one interaction deeper, for the series that has to match the
 * colour the client's own report uses - the deck palette first, a typed hex
 * behind it, and a way back to the deck's own choice.
 */
function ColorCell({
  index,
  active,
  palette,
  onPick,
  overridden,
}: {
  index: number;
  active: string;
  palette: string[];
  onPick: (hex: string | undefined) => void;
  overridden: boolean;
}) {
  // Anchored by measurement and portalled to the body: the data panel is a
  // scroll container, so a picker positioned inside it is clipped by the panel
  // rather than sitting over it.
  const [at, setAt] = useState<{ left: number; bottom: number } | null>(null);
  const open = at !== null;
  const [typed, setTyped] = useState('');

  return (
    <span style={{ display: 'inline-flex' }}>
      <button
        type="button"
        onClick={(e) => {
          if (open) { setAt(null); return; }
          const r = e.currentTarget.getBoundingClientRect();
          setAt({ left: r.left, bottom: window.innerHeight - r.top + 6 });
        }}
        title={overridden ? `Series colour #${active}. Chosen by hand.` : `Series colour #${active}, from the deck`}
        aria-label={`Colour for series ${index + 1}`}
        style={{
          width: 22, height: 22, padding: 0, cursor: 'pointer',
          background: cssHex(active),
          border: overridden ? '2px solid #fff' : '1px solid rgba(255,255,255,0.35)',
          borderRadius: 'var(--radius-sharp)',
        }}
      />
      {open && createPortal(
        <span
          style={{
            position: 'fixed', bottom: at.bottom, left: Math.min(at.left, window.innerWidth - 184), zIndex: 240,
            display: 'flex', flexDirection: 'column', gap: 6, padding: 8, width: 168,
            background: 'var(--neutral-900)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 'var(--radius-sharp)',
            boxShadow: '0 14px 30px -10px rgba(0,0,0,0.6)',
          }}
        >
          <span style={{ ...mono, color: 'rgba(255,255,255,0.4)' }}>Deck palette</span>
          <span style={{ display: 'flex', gap: 5 }}>
            {palette.map((hex, i) => (
              <button
                key={`${hex}-${i}`}
                type="button"
                onClick={() => { onPick(hex); setAt(null); }}
                title={`${CHART_SLOT_LABELS[i] ?? 'Palette'} · #${hex}`}
                aria-label={`Use ${CHART_SLOT_LABELS[i] ?? hex}`}
                style={{
                  width: 22, height: 22, padding: 0, cursor: 'pointer',
                  background: cssHex(hex),
                  border: active === hex ? '2px solid #fff' : '1px solid rgba(255,255,255,0.25)',
                  borderRadius: 'var(--radius-sharp)',
                }}
              />
            ))}
          </span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              const hex = normalizeHex(typed);
              if (hex) { onPick(hex); setAt(null); }
            }}
            placeholder="Or type a hex"
            spellCheck={false}
            style={{ ...cellInput, height: 24, fontFamily: 'var(--font-mono)', fontSize: 11 }}
            aria-label="Type a colour as hex"
          />
          {overridden && (
            <button
              type="button"
              onClick={() => { onPick(undefined); setAt(null); }}
              style={{
                height: 24, padding: '0 6px', textAlign: 'left', cursor: 'pointer',
                background: 'transparent', border: 'none',
                color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600,
              }}
            >
              Back to the deck’s colour
            </button>
          )}
        </span>,
        document.body
      )}
    </span>
  );
}

export function ChartDataEditor({ chartType, categories, series, onChange, onClose, theme = WOZKU_THEME, colors, onColorsChange }: ChartDataEditorProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dropping, setDropping] = useState(false);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);

  useEffect(() => {
    // A cell input handles its own paste (one value into one box); pasting
    // while nothing in this panel is focused replaces the whole table, same
    // split as the CSV file upload below.
    const paste = (e: ClipboardEvent) => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && wrap.current?.contains(active)) return;
      const text = e.clipboardData?.getData('text');
      const parsed = text ? parseCSV(text) : null;
      if (parsed) { e.preventDefault(); onChange(parsed); }
    };
    document.addEventListener('paste', paste);
    return () => document.removeEventListener('paste', paste);
  }, [onChange]);

  const readCSVFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const parsed = parseCSV(evt.target?.result as string);
      if (parsed) onChange(parsed);
    };
    reader.readAsText(file);
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readCSVFile(file);
  };

  // Dropping the file is the shorter route to the same place as the button, and
  // dragging a .csv onto a chart is what people try first.
  const handleDrop = (e: React.DragEvent) => {
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    e.preventDefault();
    readCSVFile(file);
    setDropping(false);
  };

  // What the chart is actually drawing right now, so a swatch shows the colour
  // on the slide rather than the colour it would be with no overrides.
  const palette = themeChartPalette(theme);
  const drawn = chartColorsFor(theme, chartType === 'pie' ? categories.length : series.length, colors);
  const setColor = (index: number, hex: string | undefined) => onColorsChange(withChartColor(colors, index, hex));

  // Pie has one slice value per category, not one value per series - editing
  // more than the first series would have nothing to render.
  const shownSeries = chartType === 'pie' ? series.slice(0, 1) : series;

  const setCategory = (i: number, label: string) => {
    const next = [...categories];
    next[i] = label;
    onChange({ categories: next, series });
  };

  const setValue = (si: number, ci: number, raw: string) => {
    const n = parseFloat(raw);
    const nextSeries = series.map((s, i) => i === si
      ? { ...s, values: s.values.map((v, j) => (j === ci ? (Number.isFinite(n) ? n : 0) : v)) }
      : s);
    onChange({ categories, series: nextSeries });
  };

  const setSeriesName = (si: number, name: string) => {
    onChange({ categories, series: series.map((s, i) => (i === si ? { ...s, name } : s)) });
  };

  const addCategory = () => onChange(withCategory({ categories, series }));

  const removeCategory = (i: number) => {
    if (categories.length <= 1) return;
    onChange({
      categories: categories.filter((_, ci) => ci !== i),
      series: series.map((s) => ({ ...s, values: s.values.filter((_, ci) => ci !== i) })),
    });
  };

  const addSeries = () => onChange(withSeries({ categories, series }));

  const removeSeries = (si: number) => {
    if (series.length <= 1) return;
    onChange({ categories, series: series.filter((_, i) => i !== si) });
  };

  return (
    <div
      ref={wrap}
      onDragOver={(e) => { e.preventDefault(); setDropping(true); }}
      onDragLeave={() => setDropping(false)}
      onDrop={handleDrop}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('input')) return;
        e.preventDefault();
      }}
      style={{
        position: 'fixed', bottom: 84, left: 'calc(50% + 150px)', transform: 'translateX(-50%)',
        zIndex: 102, width: 420, maxHeight: 380, overflowY: 'auto', padding: 12,
        background: 'var(--neutral-900)',
        boxShadow: 'var(--shadow-soft)',
        border: `1px solid ${dropping ? 'var(--emerald-500)' : 'rgba(255,255,255,0.15)'}`,
        borderRadius: 'var(--radius-sharp)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ ...mono, color: 'rgba(255,255,255,0.4)' }}>Chart data</span>
        <button title="Close" aria-label="Close" onClick={onClose} style={{ ...iconBtn, border: 'none' }}>✕</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `1fr repeat(${shownSeries.length}, 96px) 24px`, gap: 6, alignItems: 'center' }}>
        <span />
        {shownSeries.map((s, si) => (
          <span key={si} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* Pie colours belong to the categories, so its swatches sit on the
                rows rather than up here on the one series it has. */}
            {chartType !== 'pie' && (
              <ColorCell
                index={si}
                active={drawn[si] ?? palette[0]}
                palette={palette}
                overridden={Boolean(colors?.[si])}
                onPick={(hex) => setColor(si, hex)}
              />
            )}
            <input
              value={s.name}
              onChange={(e) => setSeriesName(si, e.target.value)}
              style={{ ...cellInput, ...mono, fontSize: 9, textAlign: 'center' }}
              aria-label={`Series ${si + 1} name`}
            />
          </span>
        ))}
        {chartType !== 'pie' && (
          <button title="Remove last series" aria-label="Remove last series" onClick={() => removeSeries(series.length - 1)}
            disabled={series.length <= 1} style={{ ...iconBtn, opacity: series.length <= 1 ? 0.3 : 1 }}>−</button>
        )}
        {chartType === 'pie' && <span />}

        {categories.map((cat, ci) => (
          <Fragment key={ci}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {chartType === 'pie' && (
                <ColorCell
                  index={ci}
                  active={drawn[ci] ?? palette[0]}
                  palette={palette}
                  overridden={Boolean(colors?.[ci])}
                  onPick={(hex) => setColor(ci, hex)}
                />
              )}
              <input
                value={cat}
                onChange={(e) => setCategory(ci, e.target.value)}
                style={cellInput}
                aria-label={`Category ${ci + 1} label`}
              />
            </span>
            {shownSeries.map((s, si) => (
              <input
                key={si}
                type="number"
                value={s.values[ci] ?? 0}
                onChange={(e) => setValue(si, ci, e.target.value)}
                style={{ ...cellInput, textAlign: 'right' }}
                aria-label={`${s.name} value for ${cat}`}
              />
            ))}
            <button
              title="Remove category" aria-label="Remove category"
              onClick={() => removeCategory(ci)}
              disabled={categories.length <= 1}
              style={{ ...iconBtn, opacity: categories.length <= 1 ? 0.3 : 1 }}
            >
              −
            </button>
          </Fragment>
        ))}
      </div>

      <div style={{ ...mono, color: 'rgba(255,255,255,0.35)', marginTop: 10 }}>
        {dropping
          ? 'Drop the CSV to replace this data'
          : 'Colours come from the deck. Click a swatch to change one. Paste a table from a spreadsheet, or drop a CSV file, to replace this data'}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <button
          onClick={addCategory}
          style={{ ...cellInput, cursor: 'pointer', width: 'auto', padding: '0 10px', fontWeight: 600 }}
        >
          + Category
        </button>
        {chartType !== 'pie' && (
          <button
            onClick={addSeries}
            style={{ ...cellInput, cursor: 'pointer', width: 'auto', padding: '0 10px', fontWeight: 600 }}
          >
            + Series
          </button>
        )}
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{ ...cellInput, cursor: 'pointer', width: 'auto', padding: '0 10px', fontWeight: 600, marginLeft: 'auto', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--emerald-400)', border: '1px solid var(--emerald-500)' }}
        >
          Import CSV
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={handleCSVUpload}
        />
      </div>
    </div>
  );
}

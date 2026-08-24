/**
 * The small panel behind a chart's "Data" button: lets the user rename
 * categories, edit series values, and add/remove rows or series.
 *
 * Deliberately not a Menu (formatting's usual dropdown) - it needs to sit
 * open next to the toolbar while the user edits several fields in a row, and
 * a Menu closes on outside click, which would fight typing into its own
 * inputs the moment the pointer left the input's own box.
 */

import { Fragment, useEffect, useRef } from 'react';
import type { OverlayChartSeries, OverlayChartType } from '../deck/types';

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

export function ChartDataEditor({ chartType, categories, series, onChange, onClose }: ChartDataEditorProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed) onChange(parsed);
    };
    reader.readAsText(file);
  };

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

  const addCategory = () => {
    onChange({
      categories: [...categories, `Category ${categories.length + 1}`],
      series: series.map((s) => ({ ...s, values: [...s.values, 0] })),
    });
  };

  const removeCategory = (i: number) => {
    if (categories.length <= 1) return;
    onChange({
      categories: categories.filter((_, ci) => ci !== i),
      series: series.map((s) => ({ ...s, values: s.values.filter((_, ci) => ci !== i) })),
    });
  };

  const addSeries = () => {
    onChange({
      categories,
      series: [...series, { name: `Series ${series.length + 1}`, values: categories.map(() => 0) }],
    });
  };

  const removeSeries = (si: number) => {
    if (series.length <= 1) return;
    onChange({ categories, series: series.filter((_, i) => i !== si) });
  };

  return (
    <div
      ref={wrap}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('input')) return;
        e.preventDefault();
      }}
      style={{
        position: 'fixed', bottom: 84, left: 'calc(50% + 150px)', transform: 'translateX(-50%)',
        zIndex: 102, width: 420, maxHeight: 380, overflowY: 'auto', padding: 12,
        background: 'var(--neutral-900)',
        boxShadow: 'var(--shadow-soft)',
        border: '1px solid rgba(255,255,255,0.15)',
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
          <input
            key={si}
            value={s.name}
            onChange={(e) => setSeriesName(si, e.target.value)}
            style={{ ...cellInput, ...mono, fontSize: 9, textAlign: 'center' }}
            aria-label={`Series ${si + 1} name`}
          />
        ))}
        {chartType !== 'pie' && (
          <button title="Remove last series" aria-label="Remove last series" onClick={() => removeSeries(series.length - 1)}
            disabled={series.length <= 1} style={{ ...iconBtn, opacity: series.length <= 1 ? 0.3 : 1 }}>−</button>
        )}
        {chartType === 'pie' && <span />}

        {categories.map((cat, ci) => (
          <Fragment key={ci}>
            <input
              value={cat}
              onChange={(e) => setCategory(ci, e.target.value)}
              style={cellInput}
              aria-label={`Category ${ci + 1} label`}
            />
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
        Paste a table from a spreadsheet to replace this data
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

/**
 * Presentational chart rendering shared by the canvas overlay. Pure SVG, no
 * external charting library: the shapes here are simple enough that a library
 * would cost more (bundle size, a second styling system) than it saves.
 *
 * The viewBox is built to match the shape's own aspect ratio (not a fixed
 * square) precisely so scaling stays uniform in x and y. A square viewBox
 * stretched non-uniformly to fill a non-square box would distort every glyph
 * in the axis labels - most visibly at small sizes, where the eye reads
 * warped letterforms far more easily than a slightly squashed bar.
 */

import type { OverlayChartSeries, OverlayChartType } from '../deck/types';

const SERIES_COLORS = ['#10B981', '#171717', '#A7F3D0', '#525252', '#6EE7B7'];

// The vertical axis is always 100 logical units; the horizontal one is scaled
// by the box's actual aspect ratio so one logical unit is the same physical
// size in both directions - the precondition for undistorted text and circles.
const VBH = 100;

interface ChartVisualProps {
  chartType: OverlayChartType;
  categories: string[];
  series: OverlayChartSeries[];
  /** The shape's current box, design px - used only to derive the aspect
   *  ratio the viewBox must match, not as a pixel measurement. */
  width: number;
  height: number;
  dark?: boolean;
}

export function ChartVisual({ chartType, categories, series, width, height, dark }: ChartVisualProps) {
  const ink = dark ? '#ffffff' : '#171717';
  const grid = dark ? 'rgba(255,255,255,0.18)' : 'rgba(23,23,23,0.12)';

  if (!categories.length || !series.length) return null;

  const aspect = height > 0 && width > 0 ? width / height : 16 / 9;
  const vbw = VBH * aspect;
  const padL = vbw * 0.05;
  const padR = vbw * 0.03;
  const padT = VBH * 0.06;
  const padB = VBH * 0.12;

  if (chartType === 'pie') {
    return <PieChart categories={categories} values={series[0]?.values ?? []} ink={ink} vbw={vbw} />;
  }

  const plotW = vbw - padL - padR;
  const plotH = VBH - padT - padB;
  const max = Math.max(1, ...series.flatMap((s) => s.values));

  return (
    <svg viewBox={`0 0 ${vbw} ${VBH}`} width="100%" height="100%" preserveAspectRatio="none">
      {/* Baseline + a couple of horizontal guides, matching the app's own
          hairline-grid aesthetic rather than a dense default axis grid. */}
      {[0, 0.5, 1].map((f) => (
        <line key={f} x1={padL} x2={vbw - padR} y1={padT + plotH * f} y2={padT + plotH * f} stroke={grid} strokeWidth={0.3} />
      ))}

      {chartType === 'bar' && (
        <BarSeries categories={categories} series={series} max={max} plotW={plotW} plotH={plotH} padL={padL} padT={padT} />
      )}
      {chartType === 'line' && (
        <LineSeries categories={categories} series={series} max={max} plotW={plotW} plotH={plotH} padL={padL} padT={padT} />
      )}

      {categories.map((cat, i) => {
        const cx = padL + (plotW / categories.length) * (i + 0.5);
        return (
          <text key={cat} x={cx} y={VBH - 2} fontSize={3.2} textAnchor="middle" fill={ink} opacity={0.7}>
            {cat}
          </text>
        );
      })}
    </svg>
  );
}

function BarSeries({
  categories, series, max, plotW, plotH, padL, padT,
}: { categories: string[]; series: OverlayChartSeries[]; max: number; plotW: number; plotH: number; padL: number; padT: number }) {
  const groupW = plotW / categories.length;
  const barW = (groupW * 0.6) / series.length;
  return (
    <>
      {categories.map((_, ci) =>
        series.map((s, si) => {
          const v = s.values[ci] ?? 0;
          const h = (v / max) * plotH;
          const x = padL + groupW * ci + groupW * 0.2 + si * barW;
          const y = padT + plotH - h;
          return (
            <rect key={`${ci}-${si}`} x={x} y={y} width={barW * 0.86} height={h}
              fill={SERIES_COLORS[si % SERIES_COLORS.length]} rx={0.6} />
          );
        })
      )}
    </>
  );
}

function LineSeries({
  categories, series, max, plotW, plotH, padL, padT,
}: { categories: string[]; series: OverlayChartSeries[]; max: number; plotW: number; plotH: number; padL: number; padT: number }) {
  const step = plotW / Math.max(1, categories.length - 1 || 1);
  return (
    <>
      {series.map((s, si) => {
        const pts = categories.map((_, ci) => {
          const v = s.values[ci] ?? 0;
          const x = categories.length > 1 ? padL + step * ci : padL + plotW / 2;
          const y = padT + plotH - (v / max) * plotH;
          return [x, y] as const;
        });
        return (
          <g key={si}>
            <polyline
              points={pts.map(([x, y]) => `${x},${y}`).join(' ')}
              fill="none"
              stroke={SERIES_COLORS[si % SERIES_COLORS.length]}
              strokeWidth={1.2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {pts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={1.1} fill={SERIES_COLORS[si % SERIES_COLORS.length]} />
            ))}
          </g>
        );
      })}
    </>
  );
}

function PieChart({ categories, values, ink, vbw }: { categories: string[]; values: number[]; ink: string; vbw: number }) {
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const cx = vbw / 2;
  const cy = VBH / 2 - 3;
  // The radius is capped to the smaller of the two axes so the slice stays a
  // circle rather than an ellipse when the box is wider or taller than square.
  const r = Math.min(vbw, VBH) * 0.3;
  let angle = -90;

  const slices = categories.map((cat, i) => {
    const v = values[i] ?? 0;
    const sweep = (v / total) * 360;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    const large = sweep > 180 ? 1 : 0;
    const [sx, sy] = [cx + r * Math.cos((start * Math.PI) / 180), cy + r * Math.sin((start * Math.PI) / 180)];
    const [ex, ey] = [cx + r * Math.cos((end * Math.PI) / 180), cy + r * Math.sin((end * Math.PI) / 180)];
    const path = `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey} Z`;
    return { cat, path, color: SERIES_COLORS[i % SERIES_COLORS.length] };
  });

  return (
    <svg viewBox={`0 0 ${vbw} ${VBH}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      {slices.map((s) => <path key={s.cat} d={s.path} fill={s.color} stroke="#fff" strokeWidth={0.5} />)}
      {slices.map((s, i) => (
        <g key={s.cat} transform={`translate(4, ${cy + r + 8 + i * 5})`}>
          <rect width={3} height={3} fill={s.color} />
          <text x={5} y={2.8} fontSize={3.2} fill={ink}>{s.cat}</text>
        </g>
      ))}
    </svg>
  );
}

import type { Deck, SlideContent, SlideInstance } from '../deck/types';
import type { DeckTheme } from '../theme/deckTheme';
import { WOZKU_THEME } from '../theme/deckTheme';

const PLACEHOLDER =
  'Placeholder content for the Wozku Master Template. This section will automatically populate once a Document is provided.';

/**
 * Apply the same fallback defaults that the canvas renderers use, so the HTML
 * export shows the same content as the live editor, even on a brand-new deck
 * where `content` fields are mostly undefined.
 */
function resolveDefaults(slide: SlideInstance): SlideContent {
  const c = { ...slide.content };
  const tid = slide.templateId;

  switch (tid) {
    case 's1': // Cover
      c.eyebrow = c.eyebrow ?? 'Presentation Subtitle';
      c.headingLines = c.headingLines ?? ['Master Primary', 'Heading.'];
      c.projectLabel = c.projectLabel ?? 'Project Name Placeholder';
      c.versionLabel = c.versionLabel ?? 'YYYY // Version 0.0';
      c.tagline = c.tagline ?? PLACEHOLDER;
      c.confidentialLabel = c.confidentialLabel ?? 'PROPRIETARY AND CONFIDENTIAL';
      break;

    case 's2': // Index
      c.hudLabel = c.hudLabel ?? 'Agenda';
      c.heading = c.heading ?? 'Presentation\nStructure.';
      c.parts = c.parts ?? [
        { title: 'Introduction', description: PLACEHOLDER },
        { title: 'Context', description: PLACEHOLDER },
        { title: 'Performance', description: PLACEHOLDER },
        { title: 'Strategy', description: PLACEHOLDER },
      ];
      break;

    case 's3': // Executive Summary
      c.hudLabel = c.hudLabel ?? 'Executive Summary';
      c.eyebrow = c.eyebrow ?? 'Executive Summary';
      c.heading = c.heading ?? 'Core Strategic\nObjective.';
      c.body = c.body ?? PLACEHOLDER;
      c.metricLabel = c.metricLabel ?? 'Variable Metric';
      c.metricText = c.metricText ?? '00.0%';
      break;

    case 's4': // Section Divider
      c.hudLabel = c.hudLabel ?? 'Section Marker';
      c.eyebrow = c.eyebrow ?? 'Part 02';
      c.heading = c.heading ?? 'Section Title.';
      c.subtitle = c.subtitle ?? PLACEHOLDER;
      break;

    case 's5': // Two-Column Context
      c.hudLabel = c.hudLabel ?? 'Strategic Context';
      c.leftLabel = c.leftLabel ?? 'Condition A';
      c.leftHeading = c.leftHeading ?? 'Current State\nEnvironment.';
      c.leftBody = c.leftBody ?? PLACEHOLDER;
      c.leftAttributes = c.leftAttributes ?? ['Placeholder Attribute', 'Placeholder Attribute', 'Placeholder Attribute'];
      c.rightLabel = c.rightLabel ?? 'Condition B';
      c.rightHeading = c.rightHeading ?? 'Strategic Pivot\nTarget State.';
      c.rightBody = c.rightBody ?? PLACEHOLDER;
      break;

    case 's6': // Data Monument
      c.eyebrow = c.eyebrow ?? 'Performance Metric';
      c.value = c.value ?? '000.0';
      c.unit = c.unit ?? 'M';
      c.heading = c.heading ?? 'Primary Performance Variable Title.';
      c.body = c.body ?? PLACEHOLDER;
      break;

    case 's7': // Metrics Dashboard
      c.hudLabel = c.hudLabel ?? 'Metrics Dashboard';
      c.eyebrow = c.eyebrow ?? 'Temporal Performance';
      c.bars = c.bars ?? [
        { label: 'P1', pct: 30 },
        { label: 'P2', pct: 45 },
        { label: 'P3', pct: 70 },
        { label: 'P4', pct: 95, active: true },
      ];
      c.kpis = c.kpis ?? [
        { label: 'Metric Alpha', value: '00.0%' },
        { label: 'Metric Beta', value: '00.0x' },
        { label: 'Metric Gamma', value: '-00%' },
      ];
      break;

    case 's8': // Comparative Table
      c.hudLabel = c.hudLabel ?? 'Comparative Framework';
      c.eyebrow = c.eyebrow ?? 'Benchmark Comparison';
      c.rows = c.rows ?? [
        { dim: 'Dimension 01', cur: '00.0', tgt: '00.0', delta: '+00.0%' },
        { dim: 'Dimension 02', cur: '0.00%', tgt: '0.00%', delta: '+00.0%' },
        { dim: 'Dimension 03', cur: '0,000', tgt: '0,000', delta: '+00.0%' },
        { dim: 'Dimension 04', cur: 'XXX.X', tgt: 'XXX.X', delta: '+00.0%' },
      ];
      break;

    case 's9': // Strategic Roadmap
      c.hudLabel = c.hudLabel ?? 'Execution Timeline';
      c.eyebrow = c.eyebrow ?? 'Milestone Projection';
      c.heading = c.heading ?? 'Pathway to Execution.';
      c.phases = c.phases ?? [
        { title: 'Initiation', description: PLACEHOLDER, completed: true },
        { title: 'Integration', description: PLACEHOLDER, completed: true },
        { title: 'Optimization', description: PLACEHOLDER, completed: false },
      ];
      break;

    case 's10': // Image Editorial
      c.eyebrow = c.eyebrow ?? 'Visual Narrative';
      c.heading = c.heading ?? 'Primary Insight Statement.';
      c.body = c.body ?? PLACEHOLDER;
      break;

    case 's11': // Process Architecture
      c.hudLabel = c.hudLabel ?? 'System Logic';
      c.eyebrow = c.eyebrow ?? 'Architectural Protocol';
      c.heading = c.heading ?? 'Operational Flow.';
      c.steps = c.steps ?? [
        { title: 'Input', description: PLACEHOLDER },
        { title: 'Process', description: PLACEHOLDER },
        { title: 'Output', description: PLACEHOLDER },
      ];
      break;

    case 's12': // Global Map
      c.sectors = c.sectors ?? [
        { label: 'Sector A', value: '0.0M Metric' },
        { label: 'Sector B', value: '0.0M Metric' },
        { label: 'Sector C', value: '0.0M Metric' },
      ];
      break;

    case 's13': // Featured Quote
      c.quote = c.quote ?? PLACEHOLDER;
      c.author = c.author ?? 'Author Name';
      c.role = c.role ?? 'Author Title Placeholder';
      break;

    case 's14': // Exit
      c.eyebrow = c.eyebrow ?? 'Conclusion';
      c.heading = c.heading ?? 'Thank You.';
      c.body = c.body ?? PLACEHOLDER;
      c.contacts = c.contacts && c.contacts.length ? c.contacts : ['email@placeholder.com', '@social_handle', 'www.domain.com'];
      break;
  }
  return c;
}

/** Single-file interactive HTML presentation generator */
export function generateHtmlPresentation(deck: Deck, theme: DeckTheme = WOZKU_THEME, title: string = 'Presentation'): string {
  const visible = deck.slides.filter((s) => !s.hidden);
  const slidesJson = JSON.stringify(visible.map((s, i) => ({
    id: s.instanceId,
    num: String(i + 1).padStart(2, '0'),
    title: s.title,
    templateId: s.templateId,
    content: resolveDefaults(s),
  })), null, 2);

  const total = visible.length;
  const totalPad = String(total).padStart(2, '0');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Wozku Presentation</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --font-sans: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-mono: 'JetBrains Mono', ui-monospace, monospace;
      --emerald-500: #10b981;
      --emerald-400: #34d399;
      --neutral-900: #0f172a;
      --neutral-500: #64748b;
      --neutral-200: #e2e8f0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #090a0f;
      color: #fff;
      font-family: var(--font-sans);
      overflow: hidden;
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #stage-container {
      position: relative;
      width: 1920px;
      height: 1080px;
      background: #fff;
      color: #0f172a;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      transform-origin: center center;
    }
    .slide {
      position: absolute;
      inset: 0;
      display: none;
      flex-direction: column;
      background: #ffffff;
      color: #0f172a;
    }
    .slide.active { display: flex; }
    .slide-pad { padding: 160px 140px; flex: 1; display: flex; flex-direction: column; position: relative; }
    .slide-eyebrow {
      font-family: var(--font-mono);
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      color: var(--emerald-500);
      font-weight: 600;
      margin-bottom: 16px;
    }
    .slide-title {
      font-size: 100px;
      font-weight: 600;
      line-height: 1.05;
      letter-spacing: -0.03em;
      color: var(--neutral-900);
      font-family: var(--font-sans);
      white-space: pre-line;
    }
    .slide-title-cover {
      font-size: 160px;
      font-weight: 700;
      line-height: 1.0;
      letter-spacing: -0.03em;
      color: var(--neutral-900);
      font-family: var(--font-sans);
      white-space: pre-line;
    }
    .slide-subtitle {
      font-size: 24px;
      font-weight: 500;
      color: var(--neutral-500);
      line-height: 1.5;
      white-space: pre-line;
    }
    .slide-body {
      font-size: 22px;
      color: #475569;
      line-height: 1.65;
      max-width: 1400px;
    }
    .slide-heading-sm {
      font-size: 36px;
      font-weight: 600;
      color: var(--neutral-900);
      line-height: 1.2;
      font-family: var(--font-sans);
      white-space: pre-line;
    }
    /* HUD top bar */
    .hud-top {
      position: absolute;
      top: 60px;
      left: 80px;
      right: 80px;
      display: flex;
      justify-content: space-between;
      font-family: var(--font-mono);
      font-size: 12px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--neutral-500);
      z-index: 20;
    }
    /* Data monument */
    .metric-big {
      font-size: 180px;
      font-weight: 700;
      letter-spacing: -0.04em;
      color: var(--neutral-900);
      line-height: 1;
      font-family: var(--font-sans);
    }
    .metric-unit { font-size: 60px; font-weight: 500; color: #94a3b8; margin-left: 8px; }
    .metric-label-sm {
      font-family: var(--font-mono);
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: var(--emerald-500);
      font-weight: 600;
    }
    /* Two-column */
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; flex: 1; }
    .col-label {
      font-family: var(--font-mono);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: var(--emerald-500);
      font-weight: 600;
      margin-bottom: 12px;
    }
    .col-heading { font-size: 40px; font-weight: 600; color: var(--neutral-900); margin-bottom: 16px; line-height: 1.15; white-space: pre-line; font-family: var(--font-sans); }
    .col-body { font-size: 18px; color: #475569; line-height: 1.6; }
    .col-attrs { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
    .col-attr {
      background: #f1f5f9;
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 500;
      color: #334155;
      font-family: var(--font-mono);
    }
    /* Metric bars */
    .metric-bars { display: flex; flex-direction: column; gap: 20px; flex: 1; justify-content: center; }
    .bar-row { display: flex; align-items: center; gap: 16px; }
    .bar-label { font-size: 16px; font-weight: 600; color: var(--neutral-900); width: 100px; text-align: right; }
    .bar-track { flex: 1; height: 32px; background: #f1f5f9; overflow: hidden; }
    .bar-fill { height: 100%; background: var(--emerald-500); }
    .bar-fill.active { background: var(--emerald-500); }
    .bar-fill.inactive { background: var(--neutral-200); }
    .bar-value { font-family: var(--font-mono); font-size: 14px; font-weight: 600; color: var(--neutral-900); width: 60px; }
    .kpi-grid { display: flex; gap: 32px; margin-top: 32px; }
    .kpi-card { border: 1px solid var(--neutral-200); padding: 28px; flex: 1; }
    .kpi-label { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--neutral-500); margin-bottom: 8px; }
    .kpi-value { font-size: 40px; font-weight: 700; color: var(--neutral-900); font-family: var(--font-sans); }
    /* Table */
    .comp-table { width: 100%; border-collapse: collapse; }
    .comp-table th { text-align: left; padding: 16px 24px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--neutral-500); border-bottom: 2px solid var(--neutral-200); font-family: var(--font-mono); }
    .comp-table td { padding: 16px 24px; font-size: 20px; color: #334155; border-bottom: 1px solid #f1f5f9; }
    /* Roadmap */
    .roadmap { display: flex; gap: 32px; flex: 1; align-items: stretch; margin-top: 48px; }
    .phase-card { flex: 1; border: 1px solid var(--neutral-200); padding: 36px; display: flex; flex-direction: column; gap: 14px; position: relative; }
    .phase-card.done { border-color: var(--emerald-500); }
    .phase-num { font-family: var(--font-mono); font-size: 48px; color: var(--emerald-500); font-weight: 700; }
    .phase-title { font-size: 28px; font-weight: 600; color: var(--neutral-900); font-family: var(--font-sans); }
    .phase-desc { font-size: 16px; color: #475569; line-height: 1.6; }
    /* Steps */
    .steps-grid { display: flex; gap: 32px; flex: 1; align-items: flex-start; }
    .step-card { flex: 1; border: 1px solid var(--neutral-200); padding: 40px; display: flex; flex-direction: column; gap: 14px; }
    .step-card.mid { border-color: var(--emerald-500); }
    .step-num { font-family: var(--font-mono); font-size: 48px; font-weight: 700; color: var(--emerald-500); }
    .step-title { font-size: 32px; font-weight: 600; color: var(--neutral-900); font-family: var(--font-sans); }
    .step-desc { font-size: 18px; color: #475569; line-height: 1.5; }
    /* Index */
    .index-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; flex: 1; }
    .index-part { border-left: 2px solid var(--neutral-200); padding-left: 30px; margin-bottom: 40px; }
    .index-part:first-child { border-left-color: var(--emerald-500); }
    .part-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--emerald-500); font-weight: 600; margin-bottom: 8px; }
    .part-title { font-size: 32px; font-weight: 600; color: var(--neutral-900); margin-bottom: 10px; font-family: var(--font-sans); }
    .part-desc { font-size: 18px; color: var(--neutral-500); line-height: 1.5; }
    /* Quote */
    .quote-mark { font-size: 300px; line-height: 0.5; color: var(--emerald-500); height: 105px; font-family: var(--font-sans); }
    .quote-text { font-size: 72px; font-weight: 500; line-height: 1.12; letter-spacing: -0.03em; max-width: 1440px; color: var(--neutral-900); margin-bottom: 48px; font-family: var(--font-sans); }
    .quote-author { font-size: 27px; font-weight: 600; color: var(--neutral-900); font-family: var(--font-sans); }
    .quote-role { font-size: 18px; color: var(--neutral-500); font-family: var(--font-mono); }
    /* Exit */
    .slide-exit { background: var(--neutral-900) !important; color: #fff; }
    .slide-exit .slide-title { color: #fff; font-size: 160px; font-weight: 700; }
    .slide-exit .slide-body { color: rgba(255,255,255,0.5); font-size: 28px; max-width: 800px; }
    .slide-exit .slide-eyebrow { color: var(--emerald-400); }
    .contacts-row { display: flex; gap: 60px; margin-top: 80px; font-family: var(--font-mono); font-size: 16px; color: var(--emerald-400); }
    /* Sectors */
    .sectors-list { display: flex; gap: 48px; margin-top: 24px; }
    .sector-card { padding: 20px 0; }
    .sector-label { font-size: 20px; font-weight: 600; color: var(--neutral-900); margin-bottom: 4px; }
    .sector-value { font-family: var(--font-mono); font-size: 14px; color: var(--neutral-500); }
    /* Cover bottom */
    .cover-bottom {
      position: absolute;
      bottom: 60px;
      left: 80px;
      right: 80px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: var(--font-mono);
      font-size: 14px;
      color: #94a3b8;
      z-index: 10;
    }
    /* Tagline area */
    .tagline-row {
      display: flex;
      align-items: center;
      gap: 48px;
      margin-top: 80px;
    }
    .tagline-line { width: 135px; height: 1px; background: var(--emerald-500); flex-shrink: 0; }
    .tagline-text {
      font-family: var(--font-mono);
      font-size: 16px;
      text-transform: uppercase;
      letter-spacing: 0.25em;
      color: var(--neutral-500);
      max-width: 700px;
    }
    /* Section divider */
    .slide-section-divider .slide-title { font-size: 120px; }
    /* Footer bar */
    .footer-bar {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 30px;
      padding: 8px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      z-index: 100;
    }
    .btn {
      background: transparent;
      border: none;
      color: #fff;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
    }
    .btn:hover { background: rgba(255,255,255,0.15); }
    .counter { font-family: var(--font-mono); font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.7); }
  </style>
</head>
<body>
  <div id="stage-container">
    <div id="slides-wrapper"></div>
  </div>

  <div class="footer-bar">
    <button class="btn" id="prev-btn" title="Previous (←)">❮</button>
    <span class="counter" id="counter-text">01 / ${totalPad}</span>
    <button class="btn" id="next-btn" title="Next (→)">❯</button>
    <button class="btn" id="full-btn" title="Fullscreen (F)">⛶</button>
  </div>

  <script>
    var slides = ${slidesJson};
    var currentIdx = 0;
    var stage = document.getElementById('stage-container');
    var wrapper = document.getElementById('slides-wrapper');
    var counter = document.getElementById('counter-text');

    function fitStage() {
      var w = window.innerWidth - 80;
      var h = window.innerHeight - 100;
      var scale = Math.min(w / 1920, h / 1080);
      stage.style.transform = 'scale(' + scale + ')';
    }
    window.addEventListener('resize', fitStage);
    fitStage();

    function esc(str) {
      if (!str) return '';
      var d = document.createElement('div');
      d.textContent = str;
      return d.innerHTML;
    }

    function nl2br(str) {
      return esc(str).replace(/\\n/g, '<br>');
    }

    function renderSlide(s, i) {
      var c = s.content || {};
      var tid = s.templateId || '';
      var isExit = tid === 's14';
      var html = '<div class="slide ' + (i === 0 ? 'active ' : '') + (isExit ? 'slide-exit ' : '') + (tid === 's4' ? 'slide-section-divider ' : '') + '" id="slide-' + i + '">';

      // HUD top
      if (c.hudLabel || c.projectLabel) {
        html += '<div class="hud-top"><span>' + esc(c.hudLabel || c.projectLabel || '') + '</span>';
        html += '<span>' + (c.versionLabel ? esc(c.versionLabel) : s.num) + '</span></div>';
      }

      html += '<div class="slide-pad">';

      // --- Per-template rendering ---
      if (tid === 's1') {
        // Cover
        html += '<div class="slide-eyebrow">' + esc(c.eyebrow) + '</div>';
        var lines = c.headingLines || [s.title];
        html += '<div class="slide-title-cover">';
        for (var li = 0; li < lines.length; li++) {
          if (li === lines.length - 1 && lines.length > 1) {
            html += '<span style="color:var(--emerald-500)">' + esc(lines[li]) + '</span>';
          } else {
            html += esc(lines[li]);
          }
          if (li < lines.length - 1) html += '<br>';
        }
        html += '</div>';
        if (c.tagline) {
          html += '<div class="tagline-row"><div class="tagline-line"></div>';
          html += '<div class="tagline-text">' + esc(c.tagline) + '</div></div>';
        }
        if (c.confidentialLabel) {
          html += '<div class="cover-bottom"><span>' + esc(c.confidentialLabel) + '</span></div>';
        }

      } else if (tid === 's2') {
        // Index
        html += '<div style="display:flex;gap:140px">';
        html += '<div style="flex:1"><div class="slide-eyebrow">Navigation</div>';
        html += '<div class="slide-title" style="margin-bottom:60px">' + nl2br(c.heading || s.title) + '</div></div>';
        html += '<div style="flex:1.5;padding-top:20px"><div class="index-grid">';
        var parts = c.parts || [];
        for (var pi = 0; pi < parts.length && pi < 4; pi++) {
          html += '<div class="index-part' + (pi === 0 ? '" style="border-left-color:var(--emerald-500)' : '') + '">';
          html += '<div class="part-label">Part ' + String(pi + 1).padStart(2, '0') + '</div>';
          html += '<div class="part-title">' + esc(parts[pi].title) + '</div>';
          html += '<div class="part-desc">' + esc(parts[pi].description) + '</div>';
          html += '</div>';
        }
        html += '</div></div></div>';

      } else if (tid === 's3') {
        // Executive Summary
        html += '<div class="slide-eyebrow">' + esc(c.eyebrow) + '</div>';
        html += '<div class="slide-title" style="margin-bottom:48px">' + nl2br(c.heading || s.title) + '</div>';
        if (c.body) html += '<div class="slide-body">' + esc(c.body) + '</div>';
        if (c.metricLabel || c.metricText) {
          html += '<div style="margin-top:40px;display:flex;gap:24px;align-items:baseline">';
          html += '<span class="metric-label-sm">' + esc(c.metricLabel) + '</span>';
          html += '<span style="font-size:48px;font-weight:700;color:var(--neutral-900)">' + esc(c.metricText) + '</span>';
          html += '</div>';
        }

      } else if (tid === 's4') {
        // Section Divider
        html += '<div style="display:flex;flex-direction:column;justify-content:center;flex:1">';
        html += '<div class="slide-eyebrow">' + esc(c.eyebrow) + '</div>';
        html += '<div class="slide-title" style="font-size:120px;margin-bottom:32px">' + nl2br(c.heading || s.title) + '</div>';
        if (c.subtitle) html += '<div class="slide-subtitle">' + esc(c.subtitle) + '</div>';
        html += '</div>';

      } else if (tid === 's5') {
        // Two-Column Context
        html += '<div class="two-col">';
        // Left
        html += '<div style="border-left:2px solid var(--emerald-500);padding-left:30px">';
        if (c.leftLabel) html += '<div class="col-label">' + esc(c.leftLabel) + '</div>';
        if (c.leftHeading) html += '<div class="col-heading">' + nl2br(c.leftHeading) + '</div>';
        if (c.leftBody) html += '<div class="col-body">' + esc(c.leftBody) + '</div>';
        if (c.leftAttributes && c.leftAttributes.length) {
          html += '<div class="col-attrs">';
          for (var ai = 0; ai < c.leftAttributes.length; ai++) html += '<span class="col-attr">' + esc(c.leftAttributes[ai]) + '</span>';
          html += '</div>';
        }
        html += '</div>';
        // Right
        html += '<div style="border-left:2px solid var(--neutral-200);padding-left:30px">';
        if (c.rightLabel) html += '<div class="col-label">' + esc(c.rightLabel) + '</div>';
        if (c.rightHeading) html += '<div class="col-heading">' + nl2br(c.rightHeading) + '</div>';
        if (c.rightBody) html += '<div class="col-body">' + esc(c.rightBody) + '</div>';
        html += '</div>';
        html += '</div>';

      } else if (tid === 's6') {
        // Data Monument
        html += '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;text-align:center">';
        html += '<div class="slide-eyebrow">' + esc(c.eyebrow) + '</div>';
        html += '<div class="metric-big">' + esc(c.value || '000.0');
        if (c.unit) html += '<span class="metric-unit">' + esc(c.unit) + '</span>';
        html += '</div>';
        if (c.heading) html += '<div class="slide-heading-sm" style="margin-top:40px;text-align:center">' + esc(c.heading) + '</div>';
        if (c.body) html += '<div class="slide-body" style="margin-top:16px;text-align:center">' + esc(c.body) + '</div>';
        html += '</div>';

      } else if (tid === 's7') {
        // Metrics Dashboard
        html += '<div class="slide-eyebrow">' + esc(c.eyebrow) + '</div>';
        if (c.bars && c.bars.length) {
          html += '<div class="metric-bars">';
          for (var bi = 0; bi < c.bars.length; bi++) {
            var bar = c.bars[bi];
            var pct = bar.pct || 0;
            var fillClass = bar.active ? 'active' : 'inactive';
            html += '<div class="bar-row">';
            html += '<div class="bar-label">' + esc(bar.label) + '</div>';
            html += '<div class="bar-track"><div class="bar-fill ' + fillClass + '" style="width:' + pct + '%"></div></div>';
            html += '<div class="bar-value">' + pct + '%</div>';
            html += '</div>';
          }
          html += '</div>';
        }
        if (c.kpis && c.kpis.length) {
          html += '<div class="kpi-grid">';
          for (var ki = 0; ki < c.kpis.length; ki++) {
            html += '<div class="kpi-card">';
            html += '<div class="kpi-label">' + esc(c.kpis[ki].label) + '</div>';
            html += '<div class="kpi-value">' + esc(c.kpis[ki].value) + '</div>';
            html += '</div>';
          }
          html += '</div>';
        }

      } else if (tid === 's8') {
        // Comparative Table
        html += '<div class="slide-eyebrow">' + esc(c.eyebrow) + '</div>';
        html += '<div class="slide-title" style="font-size:64px;margin-bottom:48px">' + esc(c.heading || s.title) + '</div>';
        if (c.rows && c.rows.length) {
          html += '<table class="comp-table"><thead><tr>';
          html += '<th>Dimension</th><th>Current</th><th>Target</th><th>Delta</th>';
          html += '</tr></thead><tbody>';
          for (var ri = 0; ri < c.rows.length; ri++) {
            var row = c.rows[ri];
            html += '<tr><td>' + esc(row.dim) + '</td><td>' + esc(row.cur) + '</td><td>' + esc(row.tgt) + '</td><td>' + esc(row.delta) + '</td></tr>';
          }
          html += '</tbody></table>';
        }

      } else if (tid === 's9') {
        // Strategic Roadmap
        html += '<div class="slide-eyebrow">' + esc(c.eyebrow) + '</div>';
        html += '<div class="slide-title" style="font-size:80px;margin-bottom:16px">' + nl2br(c.heading || s.title) + '</div>';
        if (c.phases && c.phases.length) {
          html += '<div class="roadmap">';
          for (var phi = 0; phi < c.phases.length; phi++) {
            var phase = c.phases[phi];
            html += '<div class="phase-card' + (phase.completed ? ' done' : '') + '">';
            html += '<div class="phase-num">' + String(phi + 1).padStart(2, '0') + '</div>';
            html += '<div class="phase-title">' + esc(phase.title) + '</div>';
            html += '<div class="phase-desc">' + esc(phase.description) + '</div>';
            html += '</div>';
          }
          html += '</div>';
        }

      } else if (tid === 's10') {
        // Image Editorial
        html += '<div class="slide-eyebrow">' + esc(c.eyebrow) + '</div>';
        html += '<div class="slide-title" style="font-size:80px;margin-bottom:32px">' + nl2br(c.heading || s.title) + '</div>';
        if (c.body) html += '<div class="slide-body">' + esc(c.body) + '</div>';
        if (c.imageUrl) html += '<img src="' + c.imageUrl + '" style="max-width:100%;max-height:400px;margin-top:24px;object-fit:contain" />';

      } else if (tid === 's11') {
        // Process Architecture
        html += '<div class="slide-eyebrow">' + esc(c.eyebrow) + '</div>';
        html += '<div class="slide-title" style="margin-bottom:60px">' + nl2br(c.heading || s.title) + '</div>';
        if (c.steps && c.steps.length) {
          html += '<div class="steps-grid">';
          for (var si = 0; si < c.steps.length; si++) {
            var step = c.steps[si];
            html += '<div class="step-card' + (si === 1 ? ' mid' : '') + '" style="margin-top:' + (si * 40) + 'px">';
            html += '<div class="step-num">' + String(si + 1).padStart(2, '0') + '</div>';
            html += '<div class="step-title">' + esc(step.title) + '</div>';
            html += '<div class="step-desc">' + esc(step.description) + '</div>';
            html += '</div>';
          }
          html += '</div>';
        }

      } else if (tid === 's12') {
        // Global Map
        html += '<div class="slide-eyebrow">' + esc(c.eyebrow || 'Global Reach') + '</div>';
        html += '<div class="slide-title" style="font-size:80px;margin-bottom:32px">' + nl2br(c.heading || s.title) + '</div>';
        if (c.sectors && c.sectors.length) {
          html += '<div class="sectors-list">';
          for (var sci = 0; sci < c.sectors.length; sci++) {
            html += '<div class="sector-card"><div class="sector-label">' + esc(c.sectors[sci].label) + '</div>';
            html += '<div class="sector-value">' + esc(c.sectors[sci].value) + '</div></div>';
          }
          html += '</div>';
        }

      } else if (tid === 's13') {
        // Featured Quote
        html += '<div style="display:flex;flex-direction:column;justify-content:center;flex:1">';
        html += '<div class="quote-mark">"</div>';
        html += '<div class="quote-text">' + esc(c.quote) + '</div>';
        html += '<div style="display:flex;align-items:center;gap:30px">';
        html += '<div><div class="quote-author">' + esc(c.author) + '</div>';
        html += '<div class="quote-role">' + esc(c.role) + '</div></div>';
        html += '</div></div>';

      } else if (tid === 's14') {
        // Exit
        html += '<div style="display:flex;flex-direction:column;justify-content:center;flex:1">';
        html += '<div class="slide-eyebrow">' + esc(c.eyebrow) + '</div>';
        html += '<div class="slide-title">' + nl2br(c.heading || s.title) + '</div>';
        if (c.body) html += '<div class="slide-body" style="margin-top:24px">' + esc(c.body) + '</div>';
        if (c.contacts && c.contacts.length) {
          html += '<div class="contacts-row">';
          for (var ci = 0; ci < c.contacts.length; ci++) html += '<span>' + esc(c.contacts[ci]) + '</span>';
          html += '</div>';
        }
        html += '</div>';

      } else {
        // Fallback (blank, imported, unknown)
        html += '<div class="slide-eyebrow">' + esc(c.eyebrow || s.title) + '</div>';
        if (c.heading) html += '<div class="slide-title" style="font-size:80px">' + nl2br(c.heading) + '</div>';
        else html += '<div class="slide-title" style="font-size:80px">' + esc(s.title || 'Untitled Slide') + '</div>';
        if (c.body) html += '<div class="slide-body" style="margin-top:32px">' + esc(c.body) + '</div>';
      }

      html += '</div></div>'; // close slide-pad and slide
      return html;
    }

    function renderSlides() {
      var allHtml = '';
      for (var i = 0; i < slides.length; i++) {
        allHtml += renderSlide(slides[i], i);
      }
      wrapper.innerHTML = allHtml;
    }
    renderSlides();

    function update() {
      var els = document.querySelectorAll('.slide');
      for (var i = 0; i < els.length; i++) {
        if (i === currentIdx) els[i].classList.add('active');
        else els[i].classList.remove('active');
      }
      counter.innerText = String(currentIdx + 1).padStart(2, '0') + ' / ' + String(slides.length).padStart(2, '0');
    }

    function go(delta) {
      currentIdx = Math.max(0, Math.min(slides.length - 1, currentIdx + delta));
      update();
    }

    document.getElementById('prev-btn').onclick = function() { go(-1); };
    document.getElementById('next-btn').onclick = function() { go(1); };
    document.getElementById('full-btn').onclick = function() {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    };

    window.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowRight' || e.key === ' ') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'f') document.getElementById('full-btn').click();
    });
  </script>
</body>
</html>`;
}

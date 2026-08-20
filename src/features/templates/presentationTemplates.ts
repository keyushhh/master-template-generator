import type { Deck, SlideInstance } from '../deck/types';
import {
  createTemplateDeck,
  createBlankSlide,
  mintInstanceId,
} from '../deck/deckBuilder';
import {
  FINTECH_SCREEN_PNG,
  ECOMMERCE_SCREEN_PNG,
  CHECKOUT_SCREEN_PNG,
  ONBOARDING_SCREEN_PNG,
  ACTIVITY_SCREEN_PNG,
} from './assets/mobileScreens';

export type TemplateCategory =
  | 'all'
  | 'product'
  | 'pitch'
  | 'marketing'
  | 'startup'
  | 'editorial'
  | 'tech'
  | 'minimal'
  | 'saved';

export interface TemplateDefinition {
  id: string;
  name: string;
  category: TemplateCategory;
  categoryLabel: string;
  badge?: string;
  author: string;
  description: string;
  slideCountText: string;
  /** Google Fonts used for display, sans, and mono */
  fonts: {
    display: string;
    sans: string;
    mono?: string;
  };
  /** Aesthetic preview colors and background style */
  preview: {
    accentColor: string;
    bgGradient: string;
    titleColor: string;
    tagBg: string;
    tagColor: string;
    subtitle: string;
  };
  defaultThemeId?: string;
  defaultAccent: string;
  build: () => Deck;
}

/** Helper to construct a customized slide */
function makeSlide(
  templateId: any,
  group: string,
  title: string,
  content: Record<string, any> = {}
): SlideInstance {
  return {
    instanceId: mintInstanceId(templateId),
    templateId,
    group,
    title,
    hidden: false,
    content,
  };
}

export const PRESENTATION_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'product-showcase',
    name: 'Product Showcase',
    category: 'product',
    categoryLabel: 'Product / App',
    badge: 'Featured',
    author: 'Wozku Studio',
    description: 'High-impact mobile device mockups, dynamic island cards, dual/triple phone hero moments, and premium whitespace.',
    slideCountText: '4 slides',
    fonts: {
      display: 'Syne',
      sans: 'Inter',
      mono: 'JetBrains Mono',
    },
    preview: {
      accentColor: '10B981',
      bgGradient: 'linear-gradient(135deg, #09090B 0%, #18181B 50%, #064E3B 100%)',
      titleColor: '#FFFFFF',
      tagBg: 'rgba(16, 185, 129, 0.25)',
      tagColor: '#6EE7B7',
      subtitle: 'Hero mobile app presentations & flagship product releases.',
    },
    defaultThemeId: 'wozku',
    defaultAccent: '10B981',
    build: () => ({
      generated: false,
      themeId: 'wozku',
      slides: [
        makeSlide('product_showcase_cover', 'Introduction', 'Product Launch Keynote', {
          headingLines: ['Next Generation', 'Mobile Experience.'],
          eyebrow: 'FLAGSHIP RELEASE // 2026',
          projectLabel: 'PRODUCT LAUNCH // V3.0',
          versionLabel: 'KEYNOTE 2026',
          tagline: 'Engineered for seamless mobile interactions, sub-second responses, and fluid user delight.',
          screenAssets: [FINTECH_SCREEN_PNG, CHECKOUT_SCREEN_PNG],
        }),
        makeSlide('product_showcase_hero', 'Product', 'Hero Interface', {
          hudLabel: 'Single Screen Hero',
          eyebrow: 'IMMERSIVE INTERFACE',
          heading: 'Fluid Interactions.\nZero Friction.',
          body: 'Every micro-animation and tactile haptic response was designed from the ground up to keep users in flow state.',
          screenAsset: FINTECH_SCREEN_PNG,
        }),
        makeSlide('product_showcase_trio', 'Product', 'Product Ecosystem', {
          hudLabel: 'Product Ecosystem',
          eyebrow: 'COMPLETE PRODUCT SUITE',
          heading: 'Unified Across All Touchpoints.',
          screenAssets: [ONBOARDING_SCREEN_PNG, FINTECH_SCREEN_PNG, CHECKOUT_SCREEN_PNG],
        }),
        makeSlide('product_showcase_closing', 'Closing', 'App Availability', {
          eyebrow: 'AVAILABLE WORLDWIDE',
          heading: 'Experience the Future\nOf Mobile Today.',
          contacts: ['appstore.com/wozku', 'product@wozku.io', 'San Francisco // Tokyo'],
        }),
      ],
    }),
  },
  {
    id: 'ux-journey',
    name: 'UX Journey & Flow',
    category: 'product',
    categoryLabel: 'Product / App',
    badge: 'New',
    author: 'Foundry UX',
    description: 'Multi-screen sequential product workflows (01 to 03), before and after UX transformations, and user onboarding steps.',
    slideCountText: '4 slides',
    fonts: {
      display: 'Plus Jakarta Sans',
      sans: 'Inter',
      mono: 'JetBrains Mono',
    },
    preview: {
      accentColor: '6366F1',
      bgGradient: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #312E81 100%)',
      titleColor: '#F8FAFC',
      tagBg: 'rgba(99, 102, 241, 0.25)',
      tagColor: '#A5B4FC',
      subtitle: 'Sequential user flows, onboarding steps, and UX case studies.',
    },
    defaultThemeId: 'wozku',
    defaultAccent: '6366F1',
    build: () => ({
      generated: false,
      themeId: 'wozku',
      slides: [
        makeSlide('ux_journey_cover', 'Introduction', 'User Journey Architecture', {
          headingLines: ['User Journey', 'Architecture.'],
          eyebrow: 'END-TO-END PRODUCT FLOW',
          projectLabel: 'EXPERIENCE AUDIT // UX ROADMAP',
          versionLabel: 'Q4 2026 // REDESIGN',
          tagline: 'Visualizing step-by-step user onboarding, friction reduction, and conversion optimization.',
          screenAsset: ONBOARDING_SCREEN_PNG,
        }),
        makeSlide('ux_journey_flow', 'Workflow', '3-Step Product Sequence', {
          hudLabel: 'Step-by-Step Workflow',
          eyebrow: '3-STEP USER WORKFLOW',
          heading: 'From Onboarding to Instant Conversion.',
          screenAssets: [ONBOARDING_SCREEN_PNG, ECOMMERCE_SCREEN_PNG, CHECKOUT_SCREEN_PNG],
        }),
        makeSlide('ux_journey_before_after', 'Workflow', 'UX Transformation Comparison', {
          hudLabel: 'UX Transformation',
          eyebrow: 'BEFORE VS AFTER',
          heading: '94% Faster Task Completion.',
          screenAssets: [ACTIVITY_SCREEN_PNG, CHECKOUT_SCREEN_PNG],
        }),
        makeSlide('ux_journey_closing', 'Closing', 'Rollout Roadmap', {
          eyebrow: 'ROLLOUT ROADMAP',
          heading: 'Accelerate Your Product\nUser Journey.',
          contacts: ['design-system@wozku.io', 'wozku.io/ux', 'San Francisco // London'],
        }),
      ],
    }),
  },
  {
    id: 'mobile-editorial',
    name: 'Mobile Editorial',
    category: 'product',
    categoryLabel: 'Product / App',
    author: 'Atelier Studio',
    description: 'Magazine-grade editorial typography with floating asymmetric mobile phone mockups and luxury e-commerce layouts.',
    slideCountText: '3 slides',
    fonts: {
      display: 'Playfair Display',
      sans: 'Plus Jakarta Sans',
      mono: 'Space Mono',
    },
    preview: {
      accentColor: 'B45309',
      bgGradient: 'linear-gradient(135deg, #292524 0%, #44403C 50%, #78350F 100%)',
      titleColor: '#FDFBF7',
      tagBg: 'rgba(180, 83, 9, 0.3)',
      tagColor: '#FDE68A',
      subtitle: 'Artistic editorial mobile presentations for luxury & lifestyle apps.',
    },
    defaultThemeId: 'template_editorial',
    defaultAccent: 'B45309',
    build: () => ({
      generated: false,
      themeId: 'template_editorial',
      slides: [
        makeSlide('mobile_editorial_cover', 'Introduction', 'Atelier Mobile Collection', {
          headingLines: ['Atelier Mobile', 'Collection.'],
          eyebrow: 'BESPOKE DIGITAL CRAFTSMANSHIP',
          projectLabel: 'DIGITAL ATELIER // ISSUE N° 08',
          versionLabel: 'AUTUMN // 2026',
          tagline: 'Translating haute-couture physical heritage into modern touch-driven digital experiences.',
          screenAsset: ECOMMERCE_SCREEN_PNG,
        }),
        makeSlide('mobile_editorial_asymmetric', 'Narrative', 'Curated Touchpoints', {
          hudLabel: 'Curated Touchpoints',
          eyebrow: 'Physical & Digital Harmony',
          heading: 'Tactile Luxury\nIn Your Palm.',
          body: 'Every swipe, gesture, and animation breathes with the cadence of fine editorial design, elevating customer perception.',
          screenAssets: [ECOMMERCE_SCREEN_PNG, CHECKOUT_SCREEN_PNG],
        }),
        makeSlide('mobile_editorial_closing', 'Closing', 'Conclusion', {
          eyebrow: 'CONCLUSION // ATELIER EDITION',
          heading: 'Curating the Next Epoch\nof Digital Commerce.',
          contacts: ['atelier@wozku.luxury', 'atelier.wozku.com', 'Paris // Milan // New York'],
        }),
      ],
    }),
  },
  {
    id: 'product-data',
    name: 'Product & Data SaaS',
    category: 'product',
    categoryLabel: 'Product / App',
    badge: 'Popular',
    author: 'Telemetry Labs',
    description: 'Analytical SaaS dashboards combining live mobile product UI with KPI performance cards and retention telemetry.',
    slideCountText: '3 slides',
    fonts: {
      display: 'Space Grotesk',
      sans: 'Inter',
      mono: 'JetBrains Mono',
    },
    preview: {
      accentColor: '0284C7',
      bgGradient: 'linear-gradient(135deg, #0B0F19 0%, #0369A1 70%, #0284C7 100%)',
      titleColor: '#F8FAFC',
      tagBg: 'rgba(2, 132, 199, 0.3)',
      tagColor: '#BAE6FD',
      subtitle: 'Product telemetry, user retention cohorts & SaaS analytics.',
    },
    defaultThemeId: 'template_ai_native',
    defaultAccent: '0284C7',
    build: () => ({
      generated: false,
      themeId: 'template_ai_native',
      slides: [
        makeSlide('product_data_cover', 'Introduction', 'Product Performance Keynote', {
          headingLines: ['Product Intelligence', '& Performance.'],
          eyebrow: 'ANALYTICAL BENCHMARK',
          projectLabel: 'LIVE PRODUCT METRICS // 2026',
          versionLabel: 'TELEMETRY V2.4',
          tagline: 'Real-time telemetry, user retention cohorts, and conversion funnel analytics.',
          screenAsset: ACTIVITY_SCREEN_PNG,
        }),
        makeSlide('product_data_screen_kpi', 'Performance', 'Retention & Engagement Lift', {
          hudLabel: 'Product Telemetry',
          eyebrow: 'ENGAGEMENT ACCELERATION',
          heading: 'Validated Retention Lift.',
          screenAsset: FINTECH_SCREEN_PNG,
          kpis: [
            { label: 'Active User Growth', value: '+42.8%' },
            { label: 'Avg Session Duration', value: '14m 20s' },
            { label: 'Net Revenue Retention', value: '138%' },
          ],
        }),
        makeSlide('product_data_closing', 'Closing', 'Enterprise Deployment', {
          eyebrow: 'ENTERPRISE DEPLOYMENT',
          heading: 'Scale With Enterprise\nProduct Intelligence.',
          contacts: ['api.wozku.io/docs', 'metrics@wozku.io', '99.99% SLA Guaranteed'],
        }),
      ],
    }),
  },
  {
    id: 'investor-memorandum',
    name: 'Investor Syndicate Memo',
    category: 'pitch',
    categoryLabel: 'Pitch deck',
    badge: 'VIP',
    author: 'Venture Syndicate',
    description: 'Gold and midnight navy institutional syndicate memo with valuation sheets, allocation matrices, and deal terms.',
    slideCountText: '3 slides',
    fonts: {
      display: 'Space Grotesk',
      sans: 'Inter',
      mono: 'Space Mono',
    },
    preview: {
      accentColor: 'F59E0B',
      bgGradient: 'linear-gradient(135deg, #0A0F1D 0%, #1E293B 50%, #78350F 100%)',
      titleColor: '#F8FAFC',
      tagBg: 'rgba(245, 158, 11, 0.25)',
      tagColor: '#FDE68A',
      subtitle: 'Institutional deal terms & syndicate allocation memos.',
    },
    defaultThemeId: 'template_startup_bold',
    defaultAccent: 'F59E0B',
    build: () => ({
      generated: false,
      themeId: 'template_startup_bold',
      slides: [
        makeSlide('investor_memo_cover', 'Introduction', 'Series A Syndicate Memo', {
          headingLines: ['Series A Syndicate', 'Memorandum.'],
          eyebrow: 'VENTURE SYNDICATE MEMO // 2026',
          projectLabel: 'INVESTMENT MEMORANDUM // CONFIDENTIAL',
          versionLabel: 'ROUND TARGET: $15,000,000',
          tagline: 'Institutional terms, capital allocation model, and venture growth trajectories.',
          confidentialLabel: 'ACCREDITED INVESTORS ONLY',
        }),
        makeSlide('investor_memo_terms', 'Terms', 'Deal Architecture', {
          hudLabel: 'Deal Architecture',
          eyebrow: 'ROUND STRUCTURE',
          heading: 'Syndicate Deal Terms & Allocation.',
          rows: [
            { dim: 'Target Round Size', cur: '$15.0M', tgt: 'Preferred Series A', delta: 'Lead Committed' },
            { dim: 'Pre-Money Valuation', cur: '$60.0M', tgt: '$75.0M Post-Money', delta: '20.0% Dilution' },
            { dim: 'ARR Run Rate', cur: '$4.2M', tgt: '$12.0M Q4 2027', delta: '+185% YoY' },
          ],
        }),
        makeSlide('investor_memo_closing', 'Closing', 'Syndicate Adjournment', {
          eyebrow: 'SYNDICATE ADJOURNMENT',
          heading: 'Join Us in Backing the Next\nCategory-Defining Leader.',
          contacts: ['partners@venturesyndicate.io', 'ir.venturesyndicate.io', 'San Francisco // New York'],
        }),
      ],
    }),
  },
  {
    id: 'editorial',
    name: 'The Editorial',
    category: 'editorial',
    categoryLabel: 'Editorial',
    badge: 'Popular',
    author: 'Wozku Studio',
    description: 'Magazine-grade typography with high-contrast serif headlines, warm stone tones, and airy layouts.',
    slideCountText: '6 slides',
    fonts: {
      display: 'Playfair Display',
      sans: 'Plus Jakarta Sans',
      mono: 'Space Mono',
    },
    preview: {
      accentColor: 'C2884A',
      bgGradient: 'linear-gradient(135deg, #181614 0%, #282420 50%, #151412 100%)',
      titleColor: '#FDFBF7',
      tagBg: 'rgba(194, 136, 74, 0.25)',
      tagColor: '#F8D7B0',
      subtitle: 'A high-concept narrative for culture, fashion & modern luxury.',
    },
    defaultThemeId: 'template_editorial',
    defaultAccent: 'C2884A',
    build: () => ({
      generated: false,
      themeId: 'template_editorial',
      slides: [
        makeSlide('editorial_cover', 'Introduction', 'The Editorial Manifesto', {
          headingLines: ['The Editorial', 'Manifesto.'],
          eyebrow: 'PRESENTED BY STUDIO WOZKU // 2026',
          projectLabel: 'STUDIO EDITORIAL // VOL. 01',
          versionLabel: 'AUTUMN 2026 // ISSUE N° 04',
          tagline: 'Distinctive aesthetics and timeless editorial restraint for modern luxury brands.',
          confidentialLabel: 'CONFIDENTIAL // PUBLICATION',
        }),
        makeSlide('editorial_exec', 'Introduction', 'Executive Narrative', {
          hudLabel: 'Executive Narrative',
          eyebrow: 'Strategic Vision',
          heading: 'Elegance Through\nRestraint.',
          body: 'In an era of hyper-accelerated digital noise, thoughtful high-contrast typography and intentional negative space build lasting brand equity.',
          metricLabel: 'Affinity Lift',
          metricText: '+184%',
        }),
        makeSlide('editorial_story', 'Context', 'Cultural Context', {
          hudLabel: 'Market Dynamics',
          leftLabel: 'Legacy Paradigm',
          leftHeading: 'Generic Velocity\n& Volume.',
          leftBody: 'Brands relying on template mass-production experience rapid commoditization and declining audience loyalty.',
          leftAttributes: ['Commoditized Aesthetics', 'Low Recall Rates', 'Friction at Scale'],
          rightLabel: 'Editorial Standard',
          rightHeading: 'Curated Heritage\n& Craft.',
          rightBody: 'Art direction treated as an enduring asset. Every publication, pitch, and touchpoint reflects bespoke discipline.',
        }),
        makeSlide('editorial_metrics', 'Context', 'Impact Monument', {
          eyebrow: 'Audience Perception',
          stat: '+184%',
          label: 'Lift in perceived brand prestige and organic engagement across Q3 editorial initiatives.',
        }),
        makeSlide('editorial_quote', 'Strategy', 'Design Philosophy', {
          eyebrow: 'Design Philosophy',
          quote: 'Combining classical high-contrast serifs with modern architectural grid systems creates enduring presence.',
          author: 'Wozku Editorial Atelier',
        }),
        makeSlide('editorial_closing', 'Closing', 'Conclusion', {
          eyebrow: 'CONCLUSION // VOLUME 01',
          heading: 'Let us build something\ntimeless together.',
          contacts: ['editorial@wozku.local', 'studio.wozku.com', '+1 (555) 019-2831'],
        }),
      ],
    }),
  },
  {
    id: 'ai-native',
    name: 'AI-Native Pitch Deck',
    category: 'tech',
    categoryLabel: 'Tech / AI',
    badge: 'New',
    author: 'Foundry AI',
    description: 'Cyber violet glow, futuristic grotesque typography, glass cards, and structured AI agent workflows.',
    slideCountText: '6 slides',
    fonts: {
      display: 'Outfit',
      sans: 'Inter',
      mono: 'JetBrains Mono',
    },
    preview: {
      accentColor: '8B5CF6',
      bgGradient: 'linear-gradient(135deg, #0B071A 0%, #1E1035 45%, #4C1D95 85%, #6D28D9 100%)',
      titleColor: '#FFFFFF',
      tagBg: 'rgba(139, 92, 246, 0.3)',
      tagColor: '#DDD6FE',
      subtitle: 'Automating enterprise intelligence with agentic systems.',
    },
    defaultThemeId: 'template_ai_native',
    defaultAccent: '7C3AED',
    build: () => ({
      generated: false,
      themeId: 'template_ai_native',
      slides: [
        makeSlide('ai_native_cover', 'Introduction', 'AI Native™ Pitch Deck', {
          headingLines: ['AI Native™', 'Pitch Deck.'],
          eyebrow: 'SERIES A DECK // OCTOBER 2026',
          projectLabel: 'FOUNDRY AGENTIC SYSTEMS',
          versionLabel: 'OCT 2026 // V1.0',
          tagline: 'Autonomous intelligence pipelines for modern engineering organizations.',
          confidentialLabel: 'PROPRIETARY AND CONFIDENTIAL',
        }),
        makeSlide('ai_native_overview', 'Introduction', 'System Architecture', {
          hudLabel: 'System Architecture & Agenda',
          heading: 'System Architecture & Objectives.',
          parts: [
            { title: 'The Autonomous Shift', description: 'Replacing brittle mechanical scripts with self-healing LLM agent networks.' },
            { title: 'Foundry Engine Core', description: 'Distributed multi-agent pipeline with deterministic validation gates.' },
            { title: 'Enterprise Traction', description: '42 enterprise deployments with 10x developer output acceleration.' },
            { title: 'Deployment Roadmap', description: 'Scaling autonomous test suites and production code repair in Q4.' },
          ],
        }),
        makeSlide('ai_native_problem', 'Introduction', 'Problem & Bottleneck', {
          hudLabel: 'Market Bottleneck',
          eyebrow: 'DEVELOPER PRODUCTIVITY BOTTLENECK',
          heading: 'Developers Spend 60%\nOn Routine Labor.',
          body: 'Modern engineering teams lose thousands of hours writing boilerplate, triaging alerts, and managing flaky tests. Our agentic pipelines execute workflows end-to-end.',
          metricLabel: 'Engineer Output Acceleration',
          metricText: '10x Speed',
        }),
        makeSlide('ai_native_metrics', 'Performance', 'Telemetry & Accuracy', {
          hudLabel: 'System Telemetry & Accuracy',
          heading: 'Deterministic Results at Scale.',
          bars: [
            { label: 'Synthetic Test Passing Rate', pct: 99.4, active: true },
            { label: 'Code Repair Success Rate', pct: 94.2, active: true },
            { label: 'Zero-Shot Patch Accuracy', pct: 88.7, active: false },
          ],
          kpis: [
            { label: 'Avg PR Resolution', value: '42s' },
            { label: 'Cost Reduction', value: '78%' },
            { label: 'ARR Run Rate', value: '$8.4M' },
          ],
        }),
        makeSlide('ai_native_pipeline', 'Strategy', 'Agentic Execution Loop', {
          hudLabel: 'Execution Pipeline',
          heading: 'Autonomous Multi-Agent Loop.',
          steps: [
            { num: '01', title: 'Context Indexing', text: 'Vector AST graphs index codebase semantics and dependencies.' },
            { num: '02', title: 'Planner Reasoning', text: 'Reasoning model creates an isolated execution graph with assertions.' },
            { num: '03', title: 'Sandboxed VM', text: 'Tests run in micro-VM environments with instant rollback.' },
            { num: '04', title: 'Safe Merge', text: 'Verified PRs are committed directly to main with full audit logs.' },
          ],
        }),
        makeSlide('ai_native_closing', 'Closing', 'Deployment Console', {
          eyebrow: 'DEPLOYMENT CONSOLE',
          heading: 'Deploy Autonomous Intelligence\nInto Your Stack.',
          contacts: ['partners@foundry.ai', 'foundry.ai/deploy', 'San Francisco, CA'],
        }),
      ],
    }),
  },
  {
    id: 'startup-bold',
    name: 'Startup Pitch Deck',
    category: 'startup',
    categoryLabel: 'Startups',
    badge: 'Popular',
    author: 'Venture Craft',
    description: 'Heavy bold title typography, high-octane contrast, vibrant electric orange accents, and clear market sizing.',
    slideCountText: '5 slides',
    fonts: {
      display: 'Syne',
      sans: 'Inter',
      mono: 'JetBrains Mono',
    },
    preview: {
      accentColor: 'EA580C',
      bgGradient: 'linear-gradient(135deg, #09090B 0%, #18181B 60%, #27272A 100%)',
      titleColor: '#FAFAFA',
      tagBg: 'rgba(234, 88, 12, 0.3)',
      tagColor: '#FDBA74',
      subtitle: 'Uncompromising clarity for seed & Series A fundraising.',
    },
    defaultThemeId: 'template_startup_bold',
    defaultAccent: 'EA580C',
    build: () => ({
      generated: false,
      themeId: 'template_startup_bold',
      slides: [
        makeSlide('startup_cover', 'Introduction', 'Startup Pitch Deck', {
          headingLines: ['Venture Craft', 'Series Seed.'],
          eyebrow: 'SERIES SEED ROUND // $3.5M TARGET',
          projectLabel: 'VENTURE CRAFT SEED',
          versionLabel: 'CONFIDENTIAL // 2026',
          tagline: 'Scaling next-generation commerce infrastructure for the modern internet.',
          confidentialLabel: 'SERIES SEED // SAN FRANCISCO, CA',
        }),
        makeSlide('startup_problem', 'Introduction', 'Problem & Opportunity', {
          hudLabel: 'The Market Friction',
          eyebrow: 'THE $48B LEAKAGE PROBLEM',
          heading: 'Checkout Friction\nCosts $48B Yearly.',
          body: 'Legacy payment gateways require 14 separate form fields and redirect users through slow multi-step authentication gates. We condense everything into a single biometric tap.',
          metricLabel: 'Cart Abandonment Rate',
          metricText: '68.8%',
        }),
        makeSlide('startup_traction', 'Performance', 'Traction & Unit Economics', {
          hudLabel: 'Financial Trajectory',
          heading: 'Consistent 24% Monthly Expansion.',
          bars: [
            { label: 'Gross Processing Volume (GPV)', pct: 96, active: true },
            { label: 'Net Revenue Retention (NRR)', pct: 92, active: true },
            { label: 'Gross Margin Expansion', pct: 84, active: false },
          ],
          kpis: [
            { label: 'Current ARR', value: '$1.8M' },
            { label: 'MoM Expansion', value: '+24%' },
            { label: 'LTV / CAC Ratio', value: '5.8x' },
          ],
        }),
        makeSlide('startup_roadmap', 'Performance', 'Go-to-Market Roadmap', {
          hudLabel: 'Execution Roadmap',
          heading: 'Go-to-Market Execution Plan.',
          phases: [
            { num: '01', title: 'Shopify & WooCommerce App', timing: 'Q1-Q2 2026', body: 'Self-serve merchant onboarding targeting mid-market D2C brands.' },
            { num: '02', title: 'EU Cross-Border Banking', timing: 'Q3-Q4 2026', body: 'Obtaining European payment institution license for zero-FX transfers.' },
            { num: '03', title: 'Enterprise SDK Launch', timing: 'Q1 2027', body: 'Direct bespoke API integrations for top 500 global retailers.' },
          ],
        }),
      ],
    }),
  },
  {
    id: 'swiss-minimal',
    name: 'Swiss Enterprise Minimal',
    category: 'minimal',
    categoryLabel: 'Minimal',
    author: 'Zurich Design',
    description: 'Pristine grid discipline, crisp monochrome palette, structured data tables, and executive elegance.',
    slideCountText: '6 slides',
    fonts: {
      display: 'Space Grotesk',
      sans: 'DM Sans',
      mono: 'Space Mono',
    },
    preview: {
      accentColor: '2563EB',
      bgGradient: 'linear-gradient(135deg, #F8FAFC 0%, #EDF2F7 50%, #E2E8F0 100%)',
      titleColor: '#0F172A',
      tagBg: 'rgba(37, 99, 235, 0.15)',
      tagColor: '#1D4ED8',
      subtitle: 'Rigorous Swiss typography and grid layout for executive reporting.',
    },
    defaultThemeId: 'template_swiss_minimal',
    defaultAccent: '2563EB',
    build: () => ({
      generated: false,
      themeId: 'template_swiss_minimal',
      slides: [
        makeSlide('swiss_cover', 'Introduction', 'Executive Board Briefing', {
          headingLines: ['Executive Board', 'Briefing.'],
          eyebrow: 'ANNUAL GENERAL MEETING // 2026',
          projectLabel: 'GOVERNANCE & AUDIT',
          versionLabel: 'Q3 2026 // FINAL REPORT',
          tagline: 'Comprehensive operational governance and strategic capital allocation report.',
          confidentialLabel: 'CONFIDENTIAL // BOARD LEVEL',
        }),
        makeSlide('swiss_metrics', 'Introduction', 'Financial Performance', {
          hudLabel: 'Financial Performance',
          eyebrow: 'OPERATING MARGIN EXPANSION',
          heading: 'Operating Margins\nExpanded +240bps.',
          body: 'Disciplined cost rationalization and recurring enterprise contracts reinforced our balance sheet against macroeconomic volatility.',
          metricLabel: 'EBITDA Margin',
          metricText: '34.2%',
        }),
        makeSlide('s5', 'Context', 'Key Findings & Capital', {
          hudLabel: 'Capital Allocation',
          leftLabel: 'Core Operations',
          leftHeading: 'Organic Cash Flow\nGeneration.',
          leftBody: 'Free cash flow increased to $42.8M, fully funding planned research and infrastructure commitments.',
          leftAttributes: ['Zero Long-term Debt', 'AAA Credit Rating', '104% Dividend Coverage'],
          rightLabel: 'Growth Investments',
          rightHeading: 'Strategic M&A\n& AI Initiatives.',
          rightBody: 'Capital deployed toward accretive acquisitions in specialized cloud compliance and automated analytics.',
        }),
        makeSlide('s8', 'Performance', 'P&L Variance Analysis', {
          hudLabel: 'Financial Variances',
          eyebrow: 'Audit Reconciliation',
          heading: 'Variance Against Plan.',
          rows: [
            { dim: 'Operating Margin', cur: '34.2%', tgt: '31.8%', delta: '+240 bps' },
            { dim: 'EBITDA Run Rate', cur: '$68.4M', tgt: '$62.0M', delta: '+$6.4M' },
            { dim: 'Free Cash Flow Conversion', cur: '88.5%', tgt: '80.0%', delta: '+850 bps' },
          ],
        }),
        makeSlide('s9', 'Performance', 'Governance Schedule', {
          hudLabel: 'Governance Timeline',
          eyebrow: 'Board Milestones',
          heading: 'Capital Allocation Roadmap.',
          phases: [
            { num: '01', title: 'Share Buyback Execution', timing: 'Q1-Q2 2026', body: '$25M authorized tranche execution with quarterly reporting.' },
            { num: '02', title: 'Credit Rating Audit', timing: 'Q3 2026', body: 'Re-affirmation of AAA institutional credit rating.' },
            { num: '03', title: 'Annual General Assembly', timing: 'Q4 2026', body: 'Presentation of audited 2026 financials to institutional shareholders.' },
          ],
        }),
        makeSlide('s14', 'Closing', 'Governance Adjournment', {
          eyebrow: 'Board Conclusion',
          heading: 'Excellence and precision in enterprise governance.',
          contacts: ['investors@zurich-design.ch', 'zurich-design.ch/ir', 'Zurich // Geneva'],
        }),
      ],
    }),
  },
  {
    id: 'wave',
    name: 'The Wave Organic',
    category: 'marketing',
    categoryLabel: 'Marketing',
    badge: 'New',
    author: 'Paloma Co.',
    description: 'Soft pastels, calm gradient halftones, humanist typography, and fluid visual breathing room.',
    slideCountText: '6 slides',
    fonts: {
      display: 'Plus Jakarta Sans',
      sans: 'Inter',
      mono: 'DM Mono',
    },
    preview: {
      accentColor: '0D9488',
      bgGradient: 'linear-gradient(135deg, #E6F4F1 0%, #D2EBE4 45%, #B7E4D8 100%)',
      titleColor: '#0F2D27',
      tagBg: 'rgba(13, 148, 136, 0.2)',
      tagColor: '#0F766E',
      subtitle: 'Harmonious pastel palettes for ecological & sustainable brands.',
    },
    defaultThemeId: 'template_wave',
    defaultAccent: '0D9488',
    build: () => ({
      generated: false,
      themeId: 'template_wave',
      slides: [
        makeSlide('wave_cover', 'Introduction', 'The Wave Organic', {
          headingLines: ['The Wave Organic', 'Impact Report.'],
          eyebrow: 'CIRCULAR DESIGN INITIATIVE',
          projectLabel: 'PALOMA SUSTAINABILITY',
          versionLabel: 'IMPACT CYCLE 2026',
          tagline: 'Restorative wellness and regenerative materials for a thriving future.',
        }),
        makeSlide('wave_metrics', 'Introduction', 'Ecological Balance', {
          hudLabel: 'Ecological Balance',
          heading: 'Measurable Ecological Harmony.',
          kpis: [
            { label: 'Trees Planted', value: '450K+' },
            { label: 'CO2 Offset', value: '1,200T' },
            { label: 'Community Trust', value: '4.9/5' },
          ],
        }),
        makeSlide('s5', 'Context', 'Sustainable Sourcing', {
          hudLabel: 'Supply Chain Model',
          leftLabel: 'Linear Production',
          leftHeading: 'Resource Depletion\n& Single-Use.',
          leftBody: 'Traditional manufacturing depletes raw inputs with high carbon emissions and irreversible landfill accumulation.',
          leftAttributes: ['High Carbon Footprint', 'Landfill Degradation', 'Opaque Sourcing'],
          rightLabel: 'Circular Design',
          rightHeading: 'Regenerative Cycles\n& Upcycling.',
          rightBody: 'Every product is designed for complete biological decomposition or permanent closed-loop reuse.',
        }),
        makeSlide('s8', 'Performance', 'Comparative Analysis', {
          hudLabel: 'Market Benchmark',
          eyebrow: 'Performance Grid',
          heading: 'Paloma Standard vs Conventional.',
          rows: [
            { dim: 'Circular Packaging', cur: '100% Recyclable', tgt: 'Zero Microplastics', delta: '+100%' },
            { dim: 'Supply Chain Audit', cur: 'Real-time On-chain', tgt: 'Quarterly Audits', delta: '+4x' },
            { dim: 'Water Usage Index', cur: '1.2L per Unit', tgt: '8.5L Industry Avg', delta: '-86%' },
          ],
        }),
        makeSlide('s12', 'Strategy', 'Global Community Reach', {
          hudLabel: 'Global Footprint',
          eyebrow: 'Community Impact',
          heading: 'Worldwide Regenerative Presence.',
          sectors: [
            { name: 'North America', status: '48 Certified Hubs', active: true },
            { name: 'Western Europe', status: '62 Regional Partners', active: true },
            { name: 'Asia Pacific', status: '28 Sourcing Collectives', active: false },
          ],
        }),
        makeSlide('s14', 'Closing', 'Cultivate What Matters', {
          eyebrow: 'Partner With Us',
          heading: 'Join our journey to a restorative future.',
          contacts: ['hello@paloma.eco', 'paloma.eco', 'Copenhagen // London'],
        }),
      ],
    }),
  },
  {
    id: 'default',
    name: 'Wozku Master Classic',
    category: 'pitch',
    categoryLabel: 'Pitch deck',
    author: 'Wozku Studio',
    description: 'All 14 canonical Wozku presentation layouts in order. Cover, agenda, executive summary, dashboards, and closing.',
    slideCountText: '14 slides',
    fonts: {
      display: 'Space Grotesk',
      sans: 'DM Sans',
      mono: 'JetBrains Mono',
    },
    preview: {
      accentColor: '10B981',
      bgGradient: 'linear-gradient(135deg, #022C22 0%, #064E3B 50%, #047857 100%)',
      titleColor: '#ECFDF5',
      tagBg: 'rgba(16, 185, 129, 0.25)',
      tagColor: '#6EE7B7',
      subtitle: 'The comprehensive 14-slide master system for any pitch.',
    },
    defaultThemeId: 'wozku',
    defaultAccent: '10B981',
    build: createTemplateDeck,
  },
  {
    id: 'blank-canvas',
    name: 'Blank Presentation',
    category: 'minimal',
    categoryLabel: 'Minimal',
    author: 'Custom',
    description: 'One blank slide. Start completely from scratch and design your deck slide-by-slide.',
    slideCountText: '1 slide',
    fonts: {
      display: 'Space Grotesk',
      sans: 'DM Sans',
      mono: 'JetBrains Mono',
    },
    preview: {
      accentColor: '64748B',
      bgGradient: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)',
      titleColor: '#F8FAFC',
      tagBg: 'rgba(148, 163, 184, 0.2)',
      tagColor: '#CBD5E1',
      subtitle: 'A clean slate with zero predefined structure.',
    },
    defaultThemeId: 'wozku',
    defaultAccent: '10B981',
    build: () => ({ generated: false, slides: [createBlankSlide()] }),
  },
];

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string }[] = [
  { id: 'all', label: 'All templates' },
  { id: 'product', label: 'Product & Mobile' },
  { id: 'pitch', label: 'Pitch deck' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'startup', label: 'Startups' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'tech', label: 'Tech / AI' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'saved', label: 'Saved templates' },
];

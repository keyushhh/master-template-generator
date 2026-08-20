/**
 * High-Resolution Presentation-Ready Mobile Screen PNG/SVG Data Assets
 * Used as the default content layer for mobile phone mockups across product templates.
 */

function createSvgDataUri(svgContent: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgContent.trim())}`;
}

export const FINTECH_SCREEN_PNG = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844" width="390" height="844">
  <defs>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#059669" />
      <stop offset="60%" stop-color="#10B981" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#09090B" />
      <stop offset="100%" stop-color="#18181B" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="390" height="844" fill="url(#bgGrad)" />

  <!-- App Header -->
  <g transform="translate(24, 50)">
    <text x="0" y="16" fill="#A1A1AA" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif" font-size="13" font-weight="600" letter-spacing="1">TOTAL ASSET BALANCE</text>
    <text x="0" y="54" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif" font-size="38" font-weight="800" letter-spacing="-1">$94,820.40</text>
    <rect x="294" y="8" width="48" height="48" rx="24" fill="#10B981" />
    <text x="318" y="38" fill="#FFFFFF" font-family="sans-serif" font-size="18" font-weight="bold" text-anchor="middle">W</text>
  </g>

  <!-- Virtual Metal Card -->
  <g transform="translate(24, 145)">
    <rect width="342" height="190" rx="22" fill="url(#cardGrad)" filter="drop-shadow(0 16px 32px rgba(5,150,105,0.4))" />
    <text x="24" y="38" fill="#FFFFFF" font-family="monospace" font-size="14" font-weight="700" letter-spacing="2">VENTURE BLACK</text>
    <text x="318" y="38" fill="#FFFFFF" font-family="sans-serif" font-size="16" font-weight="900" text-anchor="end">VISA</text>
    
    <!-- Chip -->
    <rect x="24" y="68" width="42" height="32" rx="6" fill="#FBBF24" opacity="0.9" />
    <line x1="24" y1="84" x2="66" y2="84" stroke="#D97706" stroke-width="1" />
    <line x1="45" y1="68" x2="45" y2="100" stroke="#D97706" stroke-width="1" />

    <text x="24" y="145" fill="#FFFFFF" font-family="monospace" font-size="19" font-weight="700" letter-spacing="4">•••• 8492</text>
    <text x="24" y="168" fill="rgba(255,255,255,0.75)" font-family="monospace" font-size="11">EXP 08/29</text>
    <text x="318" y="168" fill="rgba(255,255,255,0.9)" font-family="monospace" font-size="12" font-weight="600" text-anchor="end">WOZKU CLIENT</text>
  </g>

  <!-- Action Row -->
  <g transform="translate(24, 365)">
    <rect x="0" y="0" width="104" height="48" rx="14" fill="#27272A" />
    <text x="52" y="29" fill="#FFFFFF" font-family="sans-serif" font-size="14" font-weight="700" text-anchor="middle">↑ Send</text>

    <rect x="119" y="0" width="104" height="48" rx="14" fill="#27272A" />
    <text x="171" y="29" fill="#FFFFFF" font-family="sans-serif" font-size="14" font-weight="700" text-anchor="middle">↓ Receive</text>

    <rect x="238" y="0" width="104" height="48" rx="14" fill="#27272A" />
    <text x="290" y="29" fill="#FFFFFF" font-family="sans-serif" font-size="14" font-weight="700" text-anchor="middle">⇄ Swap</text>
  </g>

  <!-- Transactions Header -->
  <g transform="translate(24, 448)">
    <text x="0" y="0" fill="#A1A1AA" font-family="-apple-system, sans-serif" font-size="14" font-weight="700" letter-spacing="1">RECENT ACTIVITY</text>
    <text x="342" y="0" fill="#10B981" font-family="-apple-system, sans-serif" font-size="13" font-weight="600" text-anchor="end">View All</text>
  </g>

  <!-- Transactions List -->
  <g transform="translate(24, 470)">
    <!-- Tx 1 -->
    <rect x="0" y="0" width="342" height="68" rx="16" fill="#18181B" stroke="#27272A" stroke-width="1" />
    <circle cx="34" cy="34" r="18" fill="#3F3F46" />
    <text x="34" y="39" fill="#FFFFFF" font-family="sans-serif" font-size="14" text-anchor="middle"></text>
    <text x="64" y="28" fill="#FFFFFF" font-family="sans-serif" font-size="15" font-weight="700">Apple Store</text>
    <text x="64" y="48" fill="#A1A1AA" font-family="sans-serif" font-size="12">Hardware Acquisition</text>
    <text x="322" y="39" fill="#FFFFFF" font-family="monospace" font-size="15" font-weight="700" text-anchor="end">-$1,299.00</text>

    <!-- Tx 2 -->
    <g transform="translate(0, 80)">
      <rect x="0" y="0" width="342" height="68" rx="16" fill="#18181B" stroke="#27272A" stroke-width="1" />
      <circle cx="34" cy="34" r="18" fill="#10B981" />
      <text x="34" y="39" fill="#FFFFFF" font-family="sans-serif" font-size="14" text-anchor="middle">⚡</text>
      <text x="64" y="28" fill="#FFFFFF" font-family="sans-serif" font-size="15" font-weight="700">Stripe Settlement</text>
      <text x="64" y="48" fill="#A1A1AA" font-family="sans-serif" font-size="12">Gross Merchant Volume</text>
      <text x="322" y="39" fill="#10B981" font-family="monospace" font-size="15" font-weight="700" text-anchor="end">+$14,850.00</text>
    </g>

    <!-- Tx 3 -->
    <g transform="translate(0, 160)">
      <rect x="0" y="0" width="342" height="68" rx="16" fill="#18181B" stroke="#27272A" stroke-width="1" />
      <circle cx="34" cy="34" r="18" fill="#6366F1" />
      <text x="34" y="39" fill="#FFFFFF" font-family="sans-serif" font-size="14" text-anchor="middle">✦</text>
      <text x="64" y="28" fill="#FFFFFF" font-family="sans-serif" font-size="15" font-weight="700">Foundry AI Platform</text>
      <text x="64" y="48" fill="#A1A1AA" font-family="sans-serif" font-size="12">Monthly Subscription</text>
      <text x="322" y="39" fill="#FFFFFF" font-family="monospace" font-size="15" font-weight="700" text-anchor="end">-$480.00</text>
    </g>
  </g>
</svg>
`);

export const ECOMMERCE_SCREEN_PNG = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844" width="390" height="844">
  <defs>
    <linearGradient id="heroProd" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#292524" />
      <stop offset="100%" stop-color="#44403C" />
    </linearGradient>
    <linearGradient id="ctaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#B45309" />
      <stop offset="100%" stop-color="#D97706" />
    </linearGradient>
  </defs>

  <rect width="390" height="844" fill="#1C1917" />

  <!-- Header -->
  <g transform="translate(24, 45)">
    <text x="0" y="20" fill="#A8A29E" font-family="sans-serif" font-size="13" font-weight="700" letter-spacing="2">ATELIER WOZKU</text>
    <circle cx="330" cy="16" r="16" fill="#292524" />
    <text x="330" y="21" fill="#F5F5F4" font-family="sans-serif" font-size="14" text-anchor="middle">♡</text>
  </g>

  <!-- Hero Product Card -->
  <g transform="translate(24, 90)">
    <rect width="342" height="340" rx="28" fill="url(#heroProd)" />
    <rect x="20" y="20" width="100" height="26" rx="6" fill="#FFFFFF" />
    <text x="70" y="37" fill="#000000" font-family="sans-serif" font-size="10" font-weight="800" letter-spacing="1" text-anchor="middle">AUTUMN 2026</text>

    <!-- Product graphic placeholder -->
    <circle cx="171" cy="170" r="80" fill="rgba(255,255,255,0.05)" />
    <text x="171" y="185" fill="#F5F5F4" font-family="sans-serif" font-size="72" text-anchor="middle">👟</text>

    <text x="24" y="300" fill="#FFFFFF" font-family="serif" font-size="28" font-weight="600">Aero Matrix Pro</text>
    <text x="318" y="300" fill="#F59E0B" font-family="sans-serif" font-size="24" font-weight="800" text-anchor="end">$340</text>
  </g>

  <!-- Size selector -->
  <g transform="translate(24, 460)">
    <text x="0" y="0" fill="#A8A29E" font-family="sans-serif" font-size="12" font-weight="700" letter-spacing="1">SELECT SIZE</text>
    <g transform="translate(0, 16)">
      <rect x="0" y="0" width="76" height="44" rx="10" fill="#292524" />
      <text x="38" y="27" fill="#A8A29E" font-family="sans-serif" font-size="13" font-weight="700" text-anchor="middle">US 8.5</text>

      <rect x="88" y="0" width="76" height="44" rx="10" fill="#FFFFFF" />
      <text x="126" y="27" fill="#000000" font-family="sans-serif" font-size="13" font-weight="800" text-anchor="middle">US 9.0</text>

      <rect x="176" y="0" width="76" height="44" rx="10" fill="#292524" />
      <text x="214" y="27" fill="#A8A29E" font-family="sans-serif" font-size="13" font-weight="700" text-anchor="middle">US 9.5</text>

      <rect x="264" y="0" width="76" height="44" rx="10" fill="#292524" />
      <text x="302" y="27" fill="#A8A29E" font-family="sans-serif" font-size="13" font-weight="700" text-anchor="middle">US 10</text>
    </g>
  </g>

  <!-- Delivery info -->
  <g transform="translate(24, 560)">
    <rect width="342" height="70" rx="16" fill="#292524" />
    <text x="20" y="30" fill="#F5F5F4" font-family="sans-serif" font-size="14" font-weight="700">Free Express Delivery</text>
    <text x="20" y="50" fill="#A8A29E" font-family="sans-serif" font-size="12">Guaranteed next-day courier delivery.</text>
    <text x="322" y="40" fill="#10B981" font-family="sans-serif" font-size="16" text-anchor="end">✓</text>
  </g>

  <!-- Sticky CTA -->
  <g transform="translate(24, 660)">
    <rect width="342" height="60" rx="18" fill="url(#ctaGrad)" />
    <text x="171" y="37" fill="#FFFFFF" font-family="sans-serif" font-size="16" font-weight="800" letter-spacing="0.5" text-anchor="middle">Instant 1-Tap Checkout</text>
  </g>
</svg>
`);

export const CHECKOUT_SCREEN_PNG = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844" width="390" height="844">
  <rect width="390" height="844" fill="#09090B" />

  <!-- Success Icon -->
  <g transform="translate(195, 160)">
    <circle cx="0" cy="0" r="48" fill="#10B981" filter="drop-shadow(0 12px 24px rgba(16,185,129,0.4))" />
    <text x="0" y="14" fill="#FFFFFF" font-family="sans-serif" font-size="42" font-weight="bold" text-anchor="middle">✓</text>
  </g>

  <!-- Heading -->
  <g transform="translate(195, 260)">
    <text x="0" y="0" fill="#FFFFFF" font-family="-apple-system, sans-serif" font-size="28" font-weight="800" text-anchor="middle">Payment Confirmed</text>
    <text x="0" y="26" fill="#A1A1AA" font-family="monospace" font-size="13" text-anchor="middle">SETTLEMENT #VC-948291</text>
  </g>

  <!-- Summary Box -->
  <g transform="translate(24, 330)">
    <rect width="342" height="240" rx="20" fill="#18181B" stroke="#27272A" stroke-width="1" />
    
    <text x="24" y="40" fill="#A1A1AA" font-family="sans-serif" font-size="14">Merchant</text>
    <text x="318" y="40" fill="#FFFFFF" font-family="sans-serif" font-size="14" font-weight="700" text-anchor="end">Atelier Wozku</text>

    <text x="24" y="80" fill="#A1A1AA" font-family="sans-serif" font-size="14">Auth Protocol</text>
    <text x="318" y="80" fill="#34D399" font-family="sans-serif" font-size="14" font-weight="700" text-anchor="end">Face-ID Passkey</text>

    <text x="24" y="120" fill="#A1A1AA" font-family="sans-serif" font-size="14">Execution Speed</text>
    <text x="318" y="120" fill="#60A5FA" font-family="monospace" font-size="14" font-weight="700" text-anchor="end">0.42 Seconds</text>

    <line x1="24" y1="150" x2="318" y2="150" stroke="#27272A" stroke-width="1" />

    <text x="24" y="195" fill="#FFFFFF" font-family="sans-serif" font-size="17" font-weight="800">Total Paid</text>
    <text x="318" y="195" fill="#10B981" font-family="monospace" font-size="24" font-weight="800" text-anchor="end">$340.00</text>
  </g>

  <!-- Button -->
  <g transform="translate(24, 660)">
    <rect width="342" height="56" rx="16" fill="#27272A" />
    <text x="171" y="35" fill="#FFFFFF" font-family="sans-serif" font-size="16" font-weight="700" text-anchor="middle">View Ledger Receipt</text>
  </g>
</svg>
`);

export const ONBOARDING_SCREEN_PNG = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844" width="390" height="844">
  <defs>
    <linearGradient id="onboardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4F46E5" />
      <stop offset="100%" stop-color="#6366F1" />
    </linearGradient>
  </defs>

  <rect width="390" height="844" fill="#0F172A" />

  <!-- Hero graphic -->
  <g transform="translate(195, 180)">
    <circle cx="0" cy="0" r="90" fill="url(#onboardGrad)" opacity="0.3" filter="blur(20px)" />
    <circle cx="0" cy="0" r="70" fill="url(#onboardGrad)" />
    <text x="0" y="24" fill="#FFFFFF" font-family="sans-serif" font-size="64" text-anchor="middle">✦</text>
  </g>

  <!-- Title & Copy -->
  <g transform="translate(30, 340)">
    <text x="165" y="0" fill="#FFFFFF" font-family="-apple-system, sans-serif" font-size="34" font-weight="800" text-anchor="middle">Intelligent UX.</text>
    <text x="165" y="42" fill="#818CF8" font-family="-apple-system, sans-serif" font-size="34" font-weight="800" text-anchor="middle">Zero Friction.</text>
    
    <text x="165" y="90" fill="#94A3B8" font-family="sans-serif" font-size="16" text-anchor="middle">Next-generation biometric passkeys</text>
    <text x="165" y="116" fill="#94A3B8" font-family="sans-serif" font-size="16" text-anchor="middle">and instantaneous checkout clearing.</text>
  </g>

  <!-- Step indicators -->
  <g transform="translate(165, 540)">
    <rect x="0" y="0" width="24" height="6" rx="3" fill="#6366F1" />
    <circle cx="36" cy="3" r="3" fill="#334155" />
    <circle cx="48" cy="3" r="3" fill="#334155" />
  </g>

  <!-- Action CTA -->
  <g transform="translate(24, 640)">
    <rect width="342" height="60" rx="18" fill="url(#onboardGrad)" filter="drop-shadow(0 12px 24px rgba(99,102,241,0.4))" />
    <text x="171" y="37" fill="#FFFFFF" font-family="sans-serif" font-size="16" font-weight="800" text-anchor="middle">Get Started with Passkey</text>
  </g>
</svg>
`);

export const ACTIVITY_SCREEN_PNG = createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844" width="390" height="844">
  <rect width="390" height="844" fill="#0B0F19" />

  <!-- Header -->
  <g transform="translate(24, 50)">
    <text x="0" y="14" fill="#38BDF8" font-family="monospace" font-size="12" font-weight="700" letter-spacing="1.5">REAL-TIME TELEMETRY</text>
    <text x="0" y="48" fill="#FFFFFF" font-family="sans-serif" font-size="32" font-weight="800">System Metrics</text>
  </g>

  <!-- Ring Hero Box -->
  <g transform="translate(24, 130)">
    <rect width="342" height="200" rx="22" fill="#111827" stroke="#1F2937" stroke-width="1" />
    
    <text x="24" y="40" fill="#94A3B8" font-family="monospace" font-size="12" letter-spacing="1">VELOCITY SCORE</text>
    <text x="24" y="86" fill="#38BDF8" font-family="sans-serif" font-size="44" font-weight="800">98.4%</text>
    <text x="24" y="116" fill="#10B981" font-family="sans-serif" font-size="14" font-weight="600">+14.2% vs baseline</text>

    <!-- Ring chart graphic -->
    <circle cx="250" cy="100" r="50" fill="none" stroke="#1F2937" stroke-width="12" />
    <circle cx="250" cy="100" r="50" fill="none" stroke="#38BDF8" stroke-width="12" stroke-dasharray="280" stroke-dashoffset="40" stroke-linecap="round" />
    <text x="250" y="106" fill="#FFFFFF" font-family="sans-serif" font-size="18" font-weight="bold" text-anchor="middle">10x</text>
  </g>

  <!-- 2x2 Metric Grid -->
  <g transform="translate(24, 355)">
    <rect x="0" y="0" width="162" height="110" rx="16" fill="#111827" stroke="#1F2937" stroke-width="1" />
    <text x="18" y="32" fill="#94A3B8" font-family="monospace" font-size="11">ACTIVE TIME</text>
    <text x="18" y="70" fill="#FFFFFF" font-family="sans-serif" font-size="24" font-weight="800">6h 42m</text>
    <text x="18" y="92" fill="#10B981" font-family="sans-serif" font-size="12">Continuous</text>

    <rect x="180" y="0" width="162" height="110" rx="16" fill="#111827" stroke="#1F2937" stroke-width="1" />
    <text x="198" y="32" fill="#94A3B8" font-family="monospace" font-size="11">LATENCY</text>
    <text x="198" y="70" fill="#38BDF8" font-family="sans-serif" font-size="24" font-weight="800">14ms</text>
    <text x="198" y="92" fill="#94A3B8" font-family="sans-serif" font-size="12">Sub-second</text>
  </g>

  <!-- Status Bar -->
  <g transform="translate(24, 485)">
    <rect width="342" height="70" rx="16" fill="#111827" stroke="#1F2937" stroke-width="1" />
    <circle cx="34" cy="35" r="8" fill="#10B981" />
    <text x="54" y="32" fill="#FFFFFF" font-family="sans-serif" font-size="14" font-weight="700">Cluster Health</text>
    <text x="54" y="50" fill="#94A3B8" font-family="sans-serif" font-size="12">All 42 pods online and verified.</text>
    <text x="320" y="40" fill="#38BDF8" font-family="monospace" font-size="13" font-weight="700" text-anchor="end">99.99%</text>
  </g>
</svg>
`);

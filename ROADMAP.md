# Expansion Roadmap: Multi-Tenant Client Brands & AI Ingestion

## 1. Executive Summary & Vision

The Master Template Generator is evolving from an agency-internal presentation engine into a **multi-tenant B2B SaaS platform**. 

### The Core Value Proposition:
1. **Zero-Friction Brand Onboarding**: A client enters their website URL (e.g., `acme.com`). The engine scrapes their brand guidelines (colors, typography, logo, layout style) and provisions a fully-branded presentation workspace in seconds.
2. **Deterministic On-Brand Presentations**: Clients create and edit decks where every master slide, card, chart, and export automatically conforms to their brand identity.
3. **Super-Admin Governance**: Agency admins have global visibility over all tenant brands, decks, analytics, and master layout templates.

---

## 2. System Architecture & Roles

```
                      ┌──────────────────────────────┐
                      │    Super-Admin Dashboard     │
                      │  (Wozku Team / Global View)  │
                      └──────────────┬───────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
┌────────────────────┐    ┌────────────────────┐    ┌────────────────────┐
│   Brand Tenant A   │    │   Brand Tenant B   │    │   Brand Tenant C   │
│  (Acme Logistics)  │    │  (Kestrel Health)  │    │ (Halcyon FinTech)  │
├────────────────────┤    ├────────────────────┤    ├────────────────────┤
│ • URL Auto-Scraped │    │ • URL Auto-Scraped │    │ • URL Auto-Scraped │
│ • Custom Palettes  │    │ • Custom Palettes  │    │ • Custom Palettes  │
│ • Custom Fonts     │    │ • Custom Fonts     │    │ • Custom Fonts     │
│ • Isolated Decks   │    │ • Isolated Decks   │    │ • Isolated Decks   │
└────────────────────┘    └────────────────────┘    └────────────────────┘
```

### Role-Based Access Control (RBAC)

| Role | Scope | Key Capabilities |
| :--- | :--- | :--- |
| **Super-Admin** | Global (All Tenants) | • View all client brands, generated decks, and activity logs.<br>• Filter/Search decks by Client/Brand.<br>• Manage global master slide templates and type engine.<br>• Impersonate tenant workspaces for support/QA. |
| **Client Admin** | Single Tenant | • Manage team members within their organization.<br>• Refine auto-scraped brand guidelines (colors, logos, font stacks).<br>• Access and manage all decks owned by their brand. |
| **Client Editor** | Single Tenant | • Create, edit, collaborate, and export presentations for their brand.<br>• Restricted strictly to their tenant's Brand Kit & asset pool. |
| **Client Viewer** | Single Tenant | • View presentations and presenter view in read-only mode.<br>• Leave comments and reaction pins. |

---

## 3. "Instant Brand Ingestion" Engine

### Workflow: URL → Live Brand Kit

```
Client enters URL (e.g., "stripe.com")
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│             Brand Scraper Edge Pipeline                  │
│                                                          │
│ 1. Metadata & Favicon: Extracts SVG logos, og:image,     │
│    high-res apple-touch-icons, header logo elements.     │
│ 2. Color Palette Extraction: Parses CSS variables,       │
│    computed styles, dominant image/button colors.        │
│ 3. Typography Scraper: Identifies Google Fonts link tags,│
│    @font-face declarations, and computed font families.  │
│ 4. AI Normalizer: Clusters colors into Primary Accent,   │
│    Secondary, Card Neutral, Canvas Light, and Dark wash. │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│              Live Brand Kit Review Modal                 │
│                                                          │
│  • Brand Name: "Stripe"                                  │
│  • Primary Accent: #635BFF (Calculated 4-step ramp)      │
│  • Typography: Heading = Söhne / Inter, Body = Inter     │
│  • Logo: SVG Vector asset verified & previewed           │
│  • [Confirm & Create Workspace]                          │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Technical Migration: LocalStorage to Multi-Tenant Cloud

### Database Schema Blueprint

```sql
-- Tenants / Client Organizations
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    logo_url TEXT,
    accent_hex VARCHAR(7) NOT NULL,
    secondary_hex VARCHAR(7),
    font_heading VARCHAR(100),
    font_body VARCHAR(100),
    brand_guidelines_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Profiles & Roles
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'client_editor', -- 'super_admin' | 'client_admin' | 'client_editor' | 'client_viewer'
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Decks / Presentations (Tenant Isolated)
CREATE TABLE decks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    slides_json JSONB NOT NULL,
    theme_id VARCHAR(100),
    logo_url TEXT,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Folders
CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(50) DEFAULT 'blue',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security (RLS) Policy Example
```sql
-- Standard users can only view and modify decks belonging to their tenant
CREATE POLICY tenant_isolation_policy ON decks
    FOR ALL
    USING (
        auth.jwt() ->> 'role' = 'super_admin'
        OR tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );
```

---

## 5. Implementation Milestones

### Phase 1: Clean Foundation & Brand Encapsulation *(Completed)*
- [x] Brand Kit abstraction decoupled (`brandKitStore.ts`, `deckTheme.ts`).
- [x] Streamlined single-brand UI mode with `SHOW_BRANDS = false` feature flag.
- [x] Fully responsive, zero-radius modern Keyboard Shortcuts sheet with dynamic Windows/macOS key mapping.

### Phase 2: AI Brand Ingestion Pipeline
- [ ] Implement backend crawler/extractor endpoint (`/api/brand/extract?url=...`).
- [ ] Color extraction & contrast calculation pipeline (ensuring WCAG 2.1 AA readability).
- [ ] Google Fonts & custom font matching engine.
- [ ] "New Brand from Website" modal in Brand Kit manager.

### Phase 3: Cloud Multi-Tenancy & Authentication
- [ ] Supabase / PostgreSQL database integration with RLS.
- [ ] User authentication with organization/workspace switching.
- [ ] Sync engine for presentation decks (replacing `localStorage` for cloud workspaces).

### Phase 4: Super-Admin Command Center
- [ ] Re-enable and enhance the Global Client Filter bar and `DeckTable` for Super-Admins.
- [ ] Super-Admin overview analytics (total presentations generated per brand, active seats, export volumes).
- [ ] Global Master Template publisher (pushing new slide layouts to all client brand workspaces).

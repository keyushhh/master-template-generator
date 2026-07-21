import planviewMd from '../../../samples/planview-business-record.md?raw';

/** Campaign types named in customer interviews - used to filter the sample library. */
export type CampaignType =
  | 'Partner Advocacy'
  | 'Event Activation'
  | 'Community Activation'
  | 'Product Launch'
  | 'Sales Enablement'
  | 'Customer Advocacy';

export interface SampleDeck {
  id: string;
  name: string;
  description: string;
  campaignType: CampaignType;
  markdown: string;
}

export const CAMPAIGN_TYPES: CampaignType[] = [
  'Partner Advocacy',
  'Event Activation',
  'Community Activation',
  'Product Launch',
  'Sales Enablement',
  'Customer Advocacy',
];

/** Ready-to-load Business Records so users never start from a blank page. Every
 *  sample uses obvious placeholder tokens ([CLIENT], [LOGO]) so what still needs
 *  swapping before this goes to a real client is unambiguous. */
export const SAMPLE_DECKS: SampleDeck[] = [
  {
    id: 'planview',
    name: 'Partner Advocacy Program',
    description: 'APAC partner amplification proposal with metrics, comparison, roadmap and a quote.',
    campaignType: 'Partner Advocacy',
    markdown: planviewMd,
  },
  {
    id: 'event-journey',
    name: 'Event Journey Simulation',
    description: 'End-to-end attendee journey from registration to post-event advocacy.',
    campaignType: 'Event Activation',
    markdown: `---
version: 1.0
type: business-record
client: "[CLIENT]"
title: Event Journey Simulation
subtitle: From registration to post-event advocacy
tagline: A guided simulation of the attendee journey across a flagship event.
---

## Executive Summary

[CLIENT] runs three flagship events a year but has no unified way to show clients the end-to-end attendee journey. This simulation maps every touchpoint from registration to advocacy.

- A single view of the journey shortened proposal cycles by half.

## Context

Today each event is planned in isolation, with separate tools for registration, engagement, and follow-up.

With one journey simulation, the client sees exactly how an attendee moves from sign-up to sharing the event afterwards.

- Three flagship events per year
- Registration, engagement, and follow-up on separate tools
- No unified attendee view

## Process

- step: Register | The attendee signs up and receives a personalized agenda.
- step: Engage | During the event, sessions and booths are tracked in real time.
- step: Advocate | After the event, attendees share highlights to their networks.

## Metrics

Engagement compounds across the event lifecycle.

- bar: Pre-event | 40
- bar: Live | 80
- bar: Post-event | 95 | active
- kpi: Registrations | 3,400
- kpi: Sessions Attended | 12,800
- kpi: Post Shares | 2,100

## Closing

Full journey walkthrough and tooling map to follow.

- email: hello@wozku.com
- web: www.wozku.com
`,
  },
  {
    id: 'community-activation',
    name: 'Community Activation Plan',
    description: 'Turning a passive customer base into a self-sustaining advocacy engine.',
    campaignType: 'Community Activation',
    markdown: `---
version: 1.0
type: business-record
client: "[CLIENT]"
title: Community Activation Plan
subtitle: Turning customers into a self-sustaining advocacy engine
tagline: Activating the [CLIENT] customer community to drive organic reach.
---

## Executive Summary

[CLIENT] has a large but passive customer base. This plan activates them into an advocacy community that amplifies every launch.

## Key Metric

- value: 3.5
- unit: x
- title: Organic reach lift from an activated community

## Comparison

- row: Reach | Paid channels only | Community plus paid | Compounding organic lift
- row: Cost | High per impression | Shared by advocates | Lower blended cost
- row: Trust | Brand voice | Peer voice | Higher conversion

## Roadmap

- phase: Seed | Recruit the first cohort of advocates. | done
- phase: Grow | Expand with referral loops and challenges.
- phase: Sustain | Always-on advocacy tied to each launch.

## Quote

The community became our most credible marketing channel within a quarter.

- author: Dana Lee
- role: Head of Growth, [CLIENT]
`,
  },
  {
    id: 'product-launch',
    name: 'Product Launch Amplification',
    description: 'Coordinated launch-day push across owned, earned and partner channels.',
    campaignType: 'Product Launch',
    markdown: `---
version: 1.0
type: business-record
client: "[CLIENT]"
title: Product Launch Amplification
subtitle: Coordinated push across owned, earned and partner channels
tagline: Turning [CLIENT]'s next launch into a multi-channel moment, not a single announcement post.
---

## Executive Summary

[CLIENT] has historically launched new products through a single announcement post. This plan spreads the moment across owned channels, press, and partner advocates for sustained reach in the two weeks around launch day.

- Coordinated launch windows lifted post-launch signups by a third in comparable programs.

## Context

Today launch day is one post on one channel, with no coordinated follow-up.

A phased amplification plan keeps the launch visible for two weeks instead of one day.

- Single-channel launch announcements today
- No coordinated partner or press push
- Momentum drops off within 48 hours

## Process

- step: Tease | Partners and advocates share early access previews.
- step: Launch | Coordinated post across owned channels, press and partners on launch day.
- step: Sustain | Follow-up content and user stories carry momentum for two weeks.

## Metrics

Reach compounds when channels move together instead of in sequence.

- bar: Announcement day | 55
- bar: Week 1 | 78
- bar: Week 2 | 90 | active
- kpi: Launch Day Reach | 48,000
- kpi: Partner Shares | 210
- kpi: Signups (14-day) | 6,300

## Closing

Full channel plan and content calendar to follow.

- email: hello@wozku.com
- web: www.wozku.com
`,
  },
  {
    id: 'sales-enablement',
    name: 'Sales Enablement ROI Simulation',
    description: 'Quantifying the pipeline impact of equipping reps with a shareable proof point.',
    campaignType: 'Sales Enablement',
    markdown: `---
version: 1.0
type: business-record
client: "[CLIENT]"
title: Sales Enablement ROI Simulation
subtitle: Quantifying the pipeline impact of a shareable proof point
tagline: Showing [CLIENT]'s sales team the ROI case in the same format their prospects will see.
---

## Executive Summary

[CLIENT]'s reps ask for ROI numbers on every call but have no consistent way to show them. This simulation gives reps one shareable proof point tied to real pipeline outcomes.

## Key Metric

- value: 4.2
- unit: x
- title: Return on program spend within two quarters

## Comparison

- row: Deal Cycle | 68 days | 41 days | Faster time to close
- row: Rep Prep Time | 2 hours per call | 15 minutes per call | Reps spend more time selling
- row: Win Rate | 22 percent | 34 percent | Higher close rate with proof point in hand

## Roadmap

- phase: Pilot | Equip a single pod with the proof point. | done
- phase: Expand | Roll out to the full sales org.
- phase: Measure | Tie proof-point usage to closed-won pipeline.

## Closing

Full ROI model and rollout plan to follow.

- email: hello@wozku.com
- web: www.wozku.com
`,
  },
  {
    id: 'customer-advocacy',
    name: 'Customer Advocacy Case Study',
    description: 'Turning a single happy customer into a repeatable, sharable success story.',
    campaignType: 'Customer Advocacy',
    markdown: `---
version: 1.0
type: business-record
client: "[CLIENT]"
title: Customer Advocacy Case Study
subtitle: Turning one happy customer into a repeatable success story
tagline: A template for how [CLIENT] turns customer wins into sharable proof for the next prospect.
---

## Executive Summary

[CLIENT] has strong customer relationships but no repeatable process for turning them into case studies prospects actually see. This simulation shows the path from a happy customer to a published, sharable story.

## Context

Today case studies are written ad hoc, months after the result, and rarely reach the sales team that could use them.

A repeatable capture process turns wins into usable proof within weeks, not quarters.

- Case studies currently take 3-4 months to produce
- No standard handoff from customer success to marketing
- Sales rarely has a current story to share

## Process

- step: Capture | Customer success flags a strong result as it happens.
- step: Produce | Marketing turns the result into a short case study and sample post.
- step: Distribute | Sales and partners share the story with the next prospect.

## Quote

Having a current story ready to send made the next conversation with a prospect an easy one.

- author: Jordan Ruiz
- role: VP Customer Success, [CLIENT]

## Closing

Full capture-to-distribution workflow to follow.

- email: hello@wozku.com
- web: www.wozku.com
`,
  },
];

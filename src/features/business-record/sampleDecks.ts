import planviewMd from '../../../samples/planview-business-record.md?raw';

export interface SampleDeck {
  id: string;
  name: string;
  description: string;
  markdown: string;
}

/** Ready-to-load Business Records so users never start from a blank page. */
export const SAMPLE_DECKS: SampleDeck[] = [
  {
    id: 'planview',
    name: 'Partner Advocacy Program',
    description: 'APAC partner amplification proposal with metrics, comparison, roadmap and a quote.',
    markdown: planviewMd,
  },
  {
    id: 'event-journey',
    name: 'Event Journey Simulation',
    description: 'End-to-end attendee journey from registration to post-event advocacy.',
    markdown: `---
version: 1.0
type: business-record
client: Acme Events
title: Event Journey Simulation
subtitle: From registration to post-event advocacy
tagline: A guided simulation of the attendee journey across a flagship event.
---

## Executive Summary

Acme runs three flagship events a year but has no unified way to show clients the end-to-end attendee journey. This simulation maps every touchpoint from registration to advocacy.

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
    markdown: `---
version: 1.0
type: business-record
client: Northwind
title: Community Activation Plan
subtitle: Turning customers into a self-sustaining advocacy engine
tagline: Activating the Northwind customer community to drive organic reach.
---

## Executive Summary

Northwind has a large but passive customer base. This plan activates them into an advocacy community that amplifies every launch.

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
- role: Head of Growth, Northwind
`,
  },
];

# Interactive Surveys — Project Direction

## What system do you want to build?

An interactive survey tool that uses a one-question-at-a-time (OQAAT) conversational interface — inspired by Typeform — to maximise respondent completion rates. Surveys feel like guided conversations, not static forms.

## Core capabilities

- **OQAAT interaction model:** One question per screen with smooth transitions (200-300ms), keyboard shortcuts (Enter to advance, number keys to select options), and a progress bar.
- **10 question types:** Short text, long text, single choice, multiple choice, rating/scale, yes/no, dropdown, date picker, welcome screen, thank-you screen.
- **Conditional logic:** Simple branching — "if answer to Q3 is X, skip to Q5." Covers 90% of use cases without complexity.
- **Survey builder:** Drag-and-drop question reordering, inline editing, live preview, question type picker, templates (NPS, CSAT, event feedback).
- **Sharing:** Unique shareable link per survey, custom slugs, embeddable (iframe + JS widget), QR code generation, Open Graph meta tags for link previews.
- **Response collection:** Stored per-submission with timestamps. Partial response capture. Anonymous by default, identified if email question included. No respondent account required.
- **Analytics dashboard:** Completion rate, per-question breakdown (charts for choice, raw list for text), completion funnel (drop-off points), real-time response feed (SSE), CSV/JSON export, date/answer filtering.
- **Survey settings:** Open/close toggle, response limit, schedule (open/close dates), custom thank-you message or redirect URL, require email toggle.

## Constraints and technologies

- **Deployment:** Railway.com (managed PostgreSQL, auto-deploy from GitHub)
- **Framework:** Next.js (App Router) — Railway auto-detects, zero config
- **Database:** PostgreSQL on Railway, JSONB columns for flexible question config and answer storage
- **ORM:** Prisma
- **UI:** Tailwind CSS + shadcn/ui
- **Animations:** Framer Motion (OQAAT transitions, micro-interactions)
- **Auth:** NextAuth.js for survey creators only — respondents need zero authentication
- **Real-time:** Server-Sent Events for live response feed
- **Estimated cost:** $5-20/month on Railway

## Users

1. **Survey creators** (authenticated) — build, edit, share surveys; view responses and analytics; manage survey settings.
2. **Respondents** (anonymous, no account) — take surveys via shared link or embed; mobile-first experience; accessible (WCAG 2.1 AA).

## Integrations

- None required for MVP. Future considerations: Webhooks on response submission, REST API for CRUD, Slack notifications, email notifications, Zapier.

## Differentiator

Privacy-first: no third-party tracking on survey pages, no cookies for respondents, GDPR-compliant by design. Data stored in creator's own Railway PostgreSQL instance.

## Design principles

- Mobile-first (60%+ responses are mobile)
- Under 2 seconds to first question
- 5-8 questions ideal per survey, max 12 recommended
- Beautiful defaults — ship with 3-5 polished themes
- Under 2 minutes to create a survey, under 3 minutes to complete one
- Accessible: screen reader support, keyboard navigable, sufficient contrast, respects prefers-reduced-motion

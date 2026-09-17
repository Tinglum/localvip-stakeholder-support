# City workspace implementation plan — Bug #170

## Findings

The September 10 screenshot shows counters and empty lists without add actions. The current source has Link existing dialogs, but their persistence and matching are incomplete: the city page compares city_id with route ID 4, while business loading puts city/state text into city_id and cause loading sets city_id to null. Linking sends city_id through update hooks, although QA accounts store City and State text. A successful-looking action therefore cannot establish a reliable city membership.

## 1. Make city membership reliable first

- Define one shared city membership contract for businesses and causes. Prefer an explicit DashboardCityId foreign key on accounts, with a migration and matching GET/PUT fields in the QA backend.
- Backfill only unique exact city/state/country matches; leave ambiguous matches for an operator to resolve. Never silently move accounts or overwrite their postal addresses.
- Return the canonical city ID through business and cause list/detail APIs. Use it for city lists, counts, filters, and link-dialog exclusions.
- Add an authorized link/unlink endpoint that validates account type and city existence. Report errors visibly and refetch the city membership after success.
- Acceptance: link an existing business and a cause to City 4, reload, and confirm both remain listed with correct counts. Moving an account identifies its current city before saving. A rejected write never shows success.

## 2. Add clear business and cause actions

- Put Add business and Add school/cause beside Edit city at the top.
- Offer Create new and Link existing separately. Reuse existing CRM creation forms, preselect this city, and return to the city page after saving.
- Show these actions in empty states too. Use searchable lists with full names and current city, loading/error states, and protection against duplicate submissions.
- Replace the six-record truncation with pagination or View all. Every record opens its detail page.
- Acceptance: create, link, open, and browse all records without leaving an unexplained empty page.

## 3. Turn summaries into useful navigation

- Clicking business/cause totals or lifecycle stages opens the corresponding city-scoped list and filter.
- Open tasks and Follow-ups this week open actionable lists with the same filters used for their totals; compute totals before preview slicing.
- Add task and Log outreach reuse the existing forms with the selected city account prefilled. Allow assigning an owner, setting a due date, and recording completion/outcomes.
- Acceptance: every summary count matches the full list behind it; empty lists offer the appropriate next action.

## 4. Complete campaigns and team workflows

- Offer Create campaign and Link existing campaign with this city preselected, using the existing campaign permissions.
- Provide Assign team member through existing city-access/assignment workflows. Keep city coverage separate from a person's residential address.
- Show permission-aware controls and useful read-only states for users who cannot make changes.

## Verification and release

Test as an administrator, a permitted city operator, and an unauthorized user. Cover City 4, empty cities, duplicate city names in different states/countries, failed saves, reload persistence, and mobile layouts. Verify State editing survives a fresh GET. Ship membership/API changes before enabling dependent actions. Authenticated QA verification is still required; the screenshots alone do not establish current deployment behavior.

This is a proposed implementation plan, not a claim that the city workflows have been fixed.

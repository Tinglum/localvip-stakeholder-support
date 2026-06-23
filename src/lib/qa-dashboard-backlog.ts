export interface QaBacklogRow {
  area: string
  feature: string
  qaNeed: string
  neededApis: string
  status: string
}

// What still needs QA work before the dashboard runs fully server-side.
// Shipped + live on QA (removed from this list): outreach log, tasks, notes,
// branding uploads, offers, deals, materials library, generated materials,
// referral codes, campaign linking, business↔cause linking, and CRM pipeline
// fields (stage, status, duplicate clear/archive) via the Account /crm endpoint.
export const QA_DASHBOARD_BACKLOG_ROWS: QaBacklogRow[] = [
  {
    area: 'CRM workflow',
    feature: 'Readiness scoring, blockers, and next-action planning (pipeline stage + status already live on QA).',
    qaNeed: 'A workflow domain for checklist steps, completion state, blockers, and readiness scoring.',
    neededApis: 'GET checklist, COMPLETE step, LIST blockers, LIST next actions.',
    status: 'Needs QA workflow domain',
  },
  {
    area: 'CRM activity',
    feature: 'AI-supported outreach scripts and pushed script history tied back into CRM records.',
    qaNeed: 'Stored script drafts, outcomes, script metadata, and CRM linkage.',
    neededApis: 'LIST scripts, CREATE script log, UPDATE script outcome, LINK script to entity.',
    status: 'Needs QA workflow domain',
  },
  {
    area: 'CRM contacts',
    feature: 'Contact records, invite state, joined state, and 100-list tracking inside the dashboard.',
    qaNeed: 'Contact/lead table plus contact status fields and list participation state.',
    neededApis: 'LIST contacts, CREATE contact, UPDATE contact, IMPORT join state, ARCHIVE contact.',
    status: 'Needs QA fields + APIs',
  },
  {
    area: 'CRM ownership',
    feature: 'Owner assignment, helper assignment, stakeholder roles, and access relationships.',
    qaNeed: 'Assignment/relationship tables between accounts, users, and dashboard roles.',
    neededApis: 'LIST assignments, ASSIGN owner, ADD helper, REMOVE helper, LIST stakeholders.',
    status: 'Needs QA relationship model',
  },
  {
    area: 'QR codes',
    feature: 'QR collections, redirects, and scan analytics (single-QR generation already live).',
    qaNeed: 'QR collection, redirect, and scan-event domain in QA.',
    neededApis: 'LIST collections, UPDATE redirect, LIST scan analytics.',
    status: 'Needs QA workflow domain',
  },
  {
    area: 'Cities',
    feature: 'City records, city ownership, city views, and city access request handling.',
    qaNeed: 'City domain plus city access request tables in QA.',
    neededApis: 'LIST cities, CREATE city, UPDATE city, LIST access requests, RESOLVE access request.',
    status: 'Needs QA workflow domain',
  },
  {
    area: 'Data quality',
    feature: 'Duplicate detection + merge workflows (flag / clear / archive-as-duplicate already live).',
    qaNeed: 'Duplicate-detection scoring and a record-merge resolution domain in QA.',
    neededApis: 'LIST possible duplicates, MERGE records.',
    status: 'Needs QA workflow domain',
  },
  {
    area: 'Admin workflow',
    feature: 'Admin tasks, setup tasks, and material-engine operational queues.',
    qaNeed: 'Operational task tables and queue state in QA.',
    neededApis: 'LIST admin tasks, CREATE admin task, UPDATE admin task, COMPLETE admin task.',
    status: 'Needs QA workflow domain',
  },
  {
    area: 'Analytics',
    feature: 'Dashboard analytics rollups, QR analytics, outreach analytics, and personal performance views.',
    qaNeed: 'Reporting/analytics endpoints or rollup tables in QA.',
    neededApis: 'GET dashboard metrics, GET outreach metrics, GET QR metrics, GET user performance.',
    status: 'Needs QA analytics domain',
  },
  {
    area: 'Business portal',
    feature: 'Portal setup progress, 100-list growth, business activity, and portal growth flows.',
    qaNeed: 'Portal-specific workflow fields and portal-facing operational APIs in QA.',
    neededApis: 'GET portal setup, UPDATE portal setup, LIST portal clients, GET business activity.',
    status: 'Needs QA workflow domain',
  },
  {
    area: 'Community portal',
    feature: 'Community share links, supporter lists, mobilization activity, and community QR/material views.',
    qaNeed: 'Community engagement domain tied to causes and schools in QA.',
    neededApis: 'GET share stats, LIST supporters, GET community activity, LIST community QR assets.',
    status: 'Needs QA workflow domain',
  },
  {
    area: 'Influencer / affiliate',
    feature: 'Influencer links, referral sharing, and personal referral statistics.',
    qaNeed: 'Influencer/affiliate link tracking and stats in QA.',
    neededApis: 'LIST influencer links, CREATE share link, GET referral stats.',
    status: 'Needs QA workflow domain',
  },
  {
    area: 'Admin / audit',
    feature: 'Audit log, material-engine administration, and dashboard-side operational settings.',
    qaNeed: 'Audit event model plus admin settings domain in QA.',
    neededApis: 'LIST audit events, LIST settings, UPDATE settings, LIST generation queue.',
    status: 'Needs QA admin domain',
  },
]

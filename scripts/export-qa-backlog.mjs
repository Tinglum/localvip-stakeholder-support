import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', '..', 'LocalVIP_QA_Backlog.xlsx');

const ACCENT = { argb: 'FF4361EE' };
const DARK = { argb: 'FF1B1B1F' };
const WHITE = { argb: 'FFFFFFFF' };
const HEADER_BG = { argb: 'FF1A1A2E' };
const HEADER_FG = { argb: 'FFFFFFFF' };
const STRIPE_A = { argb: 'FFF8F9FC' };
const STRIPE_B = { argb: 'FFFFFFFF' };
const GREEN = { argb: 'FF22C55E' };
const YELLOW = { argb: 'FFEAB308' };
const ORANGE = { argb: 'FFF97316' };
const RED = { argb: 'FFEF4444' };
const GREEN_L = { argb: 'FFDCFCE7' };
const YELLOW_L = { argb: 'FFFEF9C3' };
const ORANGE_L = { argb: 'FFFFF7ED' };
const RED_L = { argb: 'FFFEE2E2' };
const DONE_BG = { argb: 'FFE8F5E9' };
const DONE_FG = { argb: 'FF2E7D32' };
const LIGHT_BORDER = { argb: 'FFDDE1E6' };

const thinBorder = {
  top: { style: 'thin', color: LIGHT_BORDER },
  bottom: { style: 'thin', color: LIGHT_BORDER },
  left: { style: 'thin', color: LIGHT_BORDER },
  right: { style: 'thin', color: LIGHT_BORDER },
};

const headerFont = { name: 'Arial', bold: true, size: 11, color: HEADER_FG };
const headerFill = { type: 'pattern', pattern: 'solid', fgColor: HEADER_BG };
const headerAlign = { horizontal: 'center', vertical: 'middle', wrapText: true };
const bodyFont = { name: 'Arial', size: 10, color: DARK };
const bodyAlign = { vertical: 'top', wrapText: true };
const centerAlign = { horizontal: 'center', vertical: 'middle', wrapText: true };

const ROWS = [
  ['CRM workflow', 'Business lifecycle, cause lifecycle, readiness scoring, blockers, and next-action planning.', 'Lifecycle fields plus a workflow domain for steps, completion state, blockers, and readiness.', 'GET/PUT lifecycle state, GET checklist, COMPLETE step, LIST blockers, LIST next actions.', 'Needs QA workflow domain'],
  ['CRM activity', 'Outreach log timeline for calls, emails, texts, visits, referrals, and follow-up outcomes.', 'Outreach activity table tied to business, cause, or stakeholder records.', 'LIST outreach, CREATE outreach, UPDATE outreach, DELETE outreach.', 'Needs QA fields + APIs'],
  ['CRM activity', 'AI-supported outreach scripts and pushed script history tied back into CRM records.', 'Stored script drafts, outcomes, script metadata, and CRM linkage.', 'LIST scripts, CREATE script log, UPDATE script outcome, LINK script to entity.', 'Needs QA workflow domain'],
  ['CRM execution', 'Tasks for businesses, causes, and team members with priority, due date, assignee, and completion.', 'Task table and assignment model in QA.', 'LIST tasks, CREATE task, UPDATE task, COMPLETE task, ARCHIVE task.', 'Needs QA fields + APIs'],
  ['CRM execution', 'Notes attached to businesses, causes, and other dashboard records.', 'Notes table with author, timestamps, entity references, and internal/public flags.', 'LIST notes, CREATE note, UPDATE note, DELETE note.', 'Needs QA fields + APIs'],
  ['CRM contacts', 'Contact records, invite state, joined state, and 100-list tracking inside the dashboard.', 'Contact/lead table plus contact status fields and list participation state.', 'LIST contacts, CREATE contact, UPDATE contact, IMPORT join state, ARCHIVE contact.', 'Needs QA fields + APIs'],
  ['CRM ownership', 'Owner assignment, helper assignment, stakeholder roles, and local access relationships.', 'Assignment/relationship tables between accounts, users, and dashboard roles.', 'LIST assignments, ASSIGN owner, ADD helper, REMOVE helper, LIST stakeholders.', 'Needs QA relationship model'],
  ['Codes + links', 'Referral codes, connection codes, and join URLs used by the material engine and capture flows.', 'Stakeholder code domain or equivalent QA fields tied to account records.', 'GET codes, UPSERT codes, RESOLVE join URL, VALIDATE code uniqueness.', 'Needs QA fields + APIs'],
  ['Branding', 'Logo and cover-photo uploads used in listing previews, QR-linked assets, and generated materials.', 'Brand asset storage fields plus file upload endpoints in QA.', 'UPLOAD logo, UPLOAD cover photo, GET brand assets, DELETE/REPLACE brand assets.', 'Needs QA file workflow'],
  ['Offers', 'Capture offer setup, cashback setup, launch-ready offer copy, and business-facing value props.', 'Offer configuration model for capture offers and dashboard-side launch offers.', 'LIST offers, CREATE offer, UPDATE offer, ARCHIVE offer.', 'Needs QA offer domain'],
  ['QR codes', 'QR code generation, linking, collections, redirects, and QR analytics inside the dashboard.', 'QR code, collection, redirect, and scan-event domain in QA.', 'LIST qr codes, CREATE qr code, UPDATE redirect, LIST collections, LIST scan analytics.', 'Needs QA workflow domain'],
  ['Materials', 'Materials library, template assignment, library folders, and stakeholder material mapping.', 'Material library domain, template metadata, and entity assignment model in QA.', 'LIST materials, CREATE material, UPDATE material, ASSIGN material, LIST templates.', 'Needs QA workflow domain'],
  ['Materials', 'Generated materials, regeneration, version history, archive/restore, and generated file tracking.', 'Generated material records with versioning, storage pointers, generation status, and restore actions.', 'GENERATE material, LIST generated versions, RESTORE version, ARCHIVE generated file.', 'Needs QA workflow domain'],
  ['Campaigns', 'Campaign creation, campaign linking, and campaign-driven launch management.', 'Campaign table and campaign-to-account relationship model in QA.', 'LIST campaigns, CREATE campaign, UPDATE campaign, LINK account to campaign.', 'Needs QA fields + APIs'],
  ['Cities', 'City records, city ownership, city views, and city access request handling.', 'City domain plus city access request tables in QA.', 'LIST cities, CREATE city, UPDATE city, LIST access requests, RESOLVE access request.', 'Needs QA workflow domain'],
  ['Relations', 'Business-to-cause linking and other dashboard-level relationship tracking.', 'Explicit account relationship model in QA beyond current account basics.', 'LINK business to cause, UNLINK business from cause, LIST linked accounts.', 'Needs QA relationship model'],
  ['Data quality', 'Duplicate detection, duplicate review, archive-as-duplicate, and later merge workflows.', 'Duplicate flagging and merge-resolution domain in QA.', 'LIST possible duplicates, FLAG duplicate, CLEAR duplicate, MERGE records, ARCHIVE duplicate.', 'Needs QA workflow domain'],
  ['Admin workflow', 'Admin tasks, setup tasks, and material-engine operational queues.', 'Operational task tables and queue state in QA.', 'LIST admin tasks, CREATE admin task, UPDATE admin task, COMPLETE admin task.', 'Needs QA workflow domain'],
  ['Analytics', 'Dashboard analytics rollups, QR analytics, outreach analytics, and personal performance views.', 'Reporting/analytics endpoints or rollup tables in QA.', 'GET dashboard metrics, GET outreach metrics, GET QR metrics, GET user performance.', 'Needs QA analytics domain'],
  ['Business portal', 'Portal setup progress, 100-list growth, business activity, and portal growth flows.', 'Portal-specific workflow fields and portal-facing operational APIs in QA.', 'GET portal setup, UPDATE portal setup, LIST portal clients, GET business activity.', 'Needs QA workflow domain'],
  ['Community portal', 'Community share links, supporter lists, mobilization activity, and community QR/material views.', 'Community engagement domain tied to causes and schools in QA.', 'GET share stats, LIST supporters, GET community activity, LIST community QR assets.', 'Needs QA workflow domain'],
  ['Influencer / affiliate', 'Influencer links, referral sharing, and personal referral statistics.', 'Influencer/affiliate link tracking and stats in QA.', 'LIST influencer links, CREATE share link, GET referral stats.', 'Needs QA workflow domain'],
  ['Admin / audit', 'Audit log, material-engine administration, and dashboard-side operational settings.', 'Audit event model plus admin settings domain in QA.', 'LIST audit events, LIST settings, UPDATE settings, LIST generation queue.', 'Needs QA admin domain'],
];

async function build() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'LocalVIP Dashboard';
  wb.created = new Date();

  // ═══════════════════════════════════════════
  // SHEET 1 — QA Implementation Backlog
  // ═══════════════════════════════════════════
  const ws = wb.addWorksheet('QA Implementation Backlog', {
    properties: { tabColor: { argb: 'FF4361EE' } },
    views: [{ state: 'frozen', ySplit: 2 }],
  });

  // Title row
  ws.mergeCells('A1:L1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'LocalVIP — QA Implementation Backlog';
  titleCell.font = { name: 'Arial', bold: true, size: 16, color: ACCENT };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: WHITE };
  ws.getRow(1).height = 42;

  const HEADERS = ['#', 'Done', 'Priority', 'Area', 'Dashboard Feature', 'What QA Needs', 'Needed APIs', 'Current Status', 'Assigned To', 'Target Date', 'Comments', 'Next Steps'];
  const COL_WIDTHS = [5, 9, 17, 18, 42, 38, 38, 24, 16, 14, 36, 36];

  HEADERS.forEach((h, i) => {
    const col = i + 1;
    const cell = ws.getCell(2, col);
    cell.value = h;
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = headerAlign;
    cell.border = thinBorder;
    ws.getColumn(col).width = COL_WIDTHS[i];
  });
  ws.getRow(2).height = 32;

  // Data rows
  ROWS.forEach((row, ri) => {
    const r = ri + 3;
    const idx = ri + 1;
    const stripe = { type: 'pattern', pattern: 'solid', fgColor: idx % 2 === 1 ? STRIPE_A : STRIPE_B };

    // #
    const numCell = ws.getCell(r, 1);
    numCell.value = idx;
    numCell.font = { name: 'Arial', size: 10, color: { argb: 'FF888888' } };
    numCell.alignment = centerAlign;
    numCell.fill = stripe;
    numCell.border = thinBorder;

    // Done
    const doneCell = ws.getCell(r, 2);
    doneCell.value = '';
    doneCell.alignment = centerAlign;
    doneCell.fill = stripe;
    doneCell.border = thinBorder;

    // Priority
    const prioCell = ws.getCell(r, 3);
    prioCell.value = '';
    prioCell.alignment = centerAlign;
    prioCell.fill = stripe;
    prioCell.border = thinBorder;

    // Data columns (Area, Feature, QA Need, APIs, Status)
    row.forEach((val, ci) => {
      const cell = ws.getCell(r, ci + 4);
      cell.value = val;
      cell.font = bodyFont;
      cell.alignment = bodyAlign;
      cell.fill = stripe;
      cell.border = thinBorder;
    });

    // Assigned To, Target Date, Comments, Next Steps
    [9, 10, 11, 12].forEach(col => {
      const cell = ws.getCell(r, col);
      cell.value = '';
      cell.font = bodyFont;
      cell.alignment = col === 10 ? centerAlign : bodyAlign;
      cell.fill = stripe;
      cell.border = thinBorder;
    });

    ws.getRow(r).height = 54;
  });

  const lastData = 2 + ROWS.length;

  // Data validation — Done
  for (let r = 3; r <= lastData; r++) {
    ws.getCell(r, 2).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"TRUE,FALSE"'],
      showErrorMessage: true,
      errorTitle: 'Invalid',
      error: 'Pick TRUE or FALSE',
      promptTitle: 'Done?',
      prompt: 'Mark TRUE when complete',
    };
  }

  // Data validation — Priority
  for (let r = 3; r <= lastData; r++) {
    ws.getCell(r, 3).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Red - Critical,Orange - High,Yellow - Medium,Green - Low"'],
      showErrorMessage: true,
      errorTitle: 'Invalid priority',
      error: 'Pick a priority level',
      promptTitle: 'Priority',
      prompt: 'Red = most urgent, Green = lowest',
    };
  }

  // Data validation — Target Date
  for (let r = 3; r <= lastData; r++) {
    ws.getCell(r, 10).numFmt = 'YYYY-MM-DD';
  }

  // Conditional formatting — Priority colors
  ws.addConditionalFormatting({
    ref: `C3:C${lastData}`,
    rules: [
      { type: 'containsText', operator: 'containsText', text: 'Red - Critical', priority: 1, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: RED_L }, font: { bold: true, color: RED } } },
      { type: 'containsText', operator: 'containsText', text: 'Orange - High', priority: 2, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: ORANGE_L }, font: { bold: true, color: ORANGE } } },
      { type: 'containsText', operator: 'containsText', text: 'Yellow - Medium', priority: 3, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: YELLOW_L }, font: { bold: true, color: YELLOW } } },
      { type: 'containsText', operator: 'containsText', text: 'Green - Low', priority: 4, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: GREEN_L }, font: { bold: true, color: GREEN } } },
    ],
  });

  // Conditional formatting — Done row strikethrough
  for (let r = 3; r <= lastData; r++) {
    ws.addConditionalFormatting({
      ref: `A${r}:L${r}`,
      rules: [{
        type: 'expression',
        formulae: [`$B${r}="TRUE"`],
        priority: 10,
        style: {
          fill: { type: 'pattern', pattern: 'solid', bgColor: DONE_BG },
          font: { color: DONE_FG, strike: true },
        },
      }],
    });
  }

  // Autofilter
  ws.autoFilter = `A2:L${lastData}`;

  // ═══════════════════════════════════════════
  // SHEET 2 — Summary Dashboard
  // ═══════════════════════════════════════════
  const ds = wb.addWorksheet('Summary Dashboard', {
    properties: { tabColor: { argb: 'FF22C55E' } },
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ds.mergeCells('A1:F1');
  ds.getCell('A1').value = 'QA Backlog Summary';
  ds.getCell('A1').font = { name: 'Arial', bold: true, size: 16, color: ACCENT };
  ds.getCell('A1').alignment = { horizontal: 'left', vertical: 'middle' };
  ds.getRow(1).height = 42;

  ['Metric', 'Value'].forEach((h, i) => {
    const cell = ds.getCell(2, i + 1);
    cell.value = h;
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = headerAlign;
    cell.border = thinBorder;
  });
  ds.getColumn(1).width = 32;
  ds.getColumn(2).width = 16;

  const ref = "'QA Implementation Backlog'";
  const metrics = [
    ['Total backlog items', { formula: `COUNTA(${ref}!A3:A${lastData})` }],
    ['Items completed (Done = TRUE)', { formula: `COUNTIF(${ref}!B3:B${lastData},"TRUE")` }],
    ['Items remaining', { formula: `COUNTA(${ref}!A3:A${lastData})-COUNTIF(${ref}!B3:B${lastData},"TRUE")` }],
    ['% Complete', { formula: `IF(COUNTA(${ref}!A3:A${lastData})=0,0,COUNTIF(${ref}!B3:B${lastData},"TRUE")/COUNTA(${ref}!A3:A${lastData}))` }],
    ['', ''],
    ['Red - Critical', { formula: `COUNTIF(${ref}!C3:C${lastData},"Red - Critical")` }],
    ['Orange - High', { formula: `COUNTIF(${ref}!C3:C${lastData},"Orange - High")` }],
    ['Yellow - Medium', { formula: `COUNTIF(${ref}!C3:C${lastData},"Yellow - Medium")` }],
    ['Green - Low', { formula: `COUNTIF(${ref}!C3:C${lastData},"Green - Low")` }],
    ['Not yet prioritized', { formula: `COUNTBLANK(${ref}!C3:C${lastData})` }],
  ];

  metrics.forEach(([label, value], i) => {
    const r = i + 3;
    const stripe = { type: 'pattern', pattern: 'solid', fgColor: i % 2 === 0 ? STRIPE_A : STRIPE_B };
    const lc = ds.getCell(r, 1);
    lc.value = label;
    lc.font = { name: 'Arial', size: 11, bold: !!label, color: DARK };
    lc.alignment = { vertical: 'middle' };
    lc.border = thinBorder;
    lc.fill = stripe;

    const vc = ds.getCell(r, 2);
    vc.value = value;
    vc.font = { name: 'Arial', size: 11, color: DARK };
    vc.alignment = centerAlign;
    vc.border = thinBorder;
    vc.fill = stripe;

    if (label === '% Complete') vc.numFmt = '0.0%';

    if (label.startsWith('Red')) lc.font = { name: 'Arial', size: 11, bold: true, color: RED };
    else if (label.startsWith('Orange')) lc.font = { name: 'Arial', size: 11, bold: true, color: ORANGE };
    else if (label.startsWith('Yellow')) lc.font = { name: 'Arial', size: 11, bold: true, color: YELLOW };
    else if (label.startsWith('Green')) lc.font = { name: 'Arial', size: 11, bold: true, color: GREEN };
  });

  // Area breakdown
  const areaStart = 15;
  ds.mergeCells(`A${areaStart}:B${areaStart}`);
  ds.getCell(`A${areaStart}`).value = 'Breakdown by Area';
  ds.getCell(`A${areaStart}`).font = { name: 'Arial', bold: true, size: 13, color: ACCENT };
  ds.getRow(areaStart).height = 30;

  ['Area', 'Count'].forEach((h, i) => {
    const cell = ds.getCell(areaStart + 1, i + 1);
    cell.value = h;
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = headerAlign;
    cell.border = thinBorder;
  });

  const areas = [...new Set(ROWS.map(r => r[0]))].sort();
  areas.forEach((area, i) => {
    const r = areaStart + 2 + i;
    const stripe = { type: 'pattern', pattern: 'solid', fgColor: i % 2 === 0 ? STRIPE_A : STRIPE_B };
    const ac = ds.getCell(r, 1);
    ac.value = area;
    ac.font = bodyFont;
    ac.alignment = { vertical: 'middle' };
    ac.border = thinBorder;
    ac.fill = stripe;

    const cc = ds.getCell(r, 2);
    cc.value = { formula: `COUNTIF(${ref}!D3:D${lastData},A${r})` };
    cc.font = bodyFont;
    cc.alignment = centerAlign;
    cc.border = thinBorder;
    cc.fill = stripe;
  });

  // ═══════════════════════════════════════════
  // SHEET 3 — API Inventory
  // ═══════════════════════════════════════════
  const ai = wb.addWorksheet('API Inventory', {
    properties: { tabColor: { argb: 'FFF97316' } },
    views: [{ state: 'frozen', ySplit: 2 }],
  });

  ai.mergeCells('A1:F1');
  ai.getCell('A1').value = 'API Endpoints Needed for QA';
  ai.getCell('A1').font = { name: 'Arial', bold: true, size: 16, color: ACCENT };
  ai.getCell('A1').alignment = { horizontal: 'left', vertical: 'middle' };
  ai.getRow(1).height = 42;

  const apiHeaders = ['#', 'Area', 'Endpoint / Action', 'Related Feature', 'Complexity', 'Built?'];
  const apiWidths = [5, 18, 40, 48, 14, 10];
  apiHeaders.forEach((h, i) => {
    const cell = ai.getCell(2, i + 1);
    cell.value = h;
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = headerAlign;
    cell.border = thinBorder;
    ai.getColumn(i + 1).width = apiWidths[i];
  });
  ai.getRow(2).height = 32;

  let apiRow = 3;
  ROWS.forEach(([area, feature, , apis]) => {
    apis.split(',').map(e => e.trim().replace(/\.$/, '')).filter(Boolean).forEach(endpoint => {
      const idx = apiRow - 2;
      const stripe = { type: 'pattern', pattern: 'solid', fgColor: idx % 2 === 1 ? STRIPE_A : STRIPE_B };

      const nc = ai.getCell(apiRow, 1);
      nc.value = idx;
      nc.font = { name: 'Arial', size: 10, color: { argb: 'FF888888' } };
      nc.alignment = centerAlign;
      nc.fill = stripe;
      nc.border = thinBorder;

      const ac = ai.getCell(apiRow, 2);
      ac.value = area;
      ac.font = bodyFont;
      ac.alignment = bodyAlign;
      ac.fill = stripe;
      ac.border = thinBorder;

      const ec = ai.getCell(apiRow, 3);
      ec.value = endpoint;
      ec.font = { name: 'Arial', size: 10, color: DARK, bold: true };
      ec.alignment = bodyAlign;
      ec.fill = stripe;
      ec.border = thinBorder;

      const fc = ai.getCell(apiRow, 4);
      fc.value = feature;
      fc.font = bodyFont;
      fc.alignment = bodyAlign;
      fc.fill = stripe;
      fc.border = thinBorder;

      // Complexity
      const xc = ai.getCell(apiRow, 5);
      xc.value = '';
      xc.alignment = centerAlign;
      xc.fill = stripe;
      xc.border = thinBorder;
      xc.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Low,Medium,High"'],
      };

      // Built?
      const bc = ai.getCell(apiRow, 6);
      bc.value = '';
      bc.alignment = centerAlign;
      bc.fill = stripe;
      bc.border = thinBorder;
      bc.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"YES,NO,IN PROGRESS"'],
      };

      apiRow++;
    });
  });

  const apiLast = apiRow - 1;

  ai.addConditionalFormatting({
    ref: `F3:F${apiLast}`,
    rules: [
      { type: 'containsText', operator: 'containsText', text: 'YES', priority: 1, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: GREEN_L }, font: { bold: true, color: GREEN } } },
      { type: 'containsText', operator: 'containsText', text: 'NO', priority: 2, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: RED_L }, font: { bold: true, color: RED } } },
      { type: 'containsText', operator: 'containsText', text: 'IN PROGRESS', priority: 3, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: YELLOW_L }, font: { bold: true, color: YELLOW } } },
    ],
  });

  ai.autoFilter = `A2:F${apiLast}`;

  // ═══════════════════════════════════════════
  // SHEET 4 — Changelog
  // ═══════════════════════════════════════════
  const cl = wb.addWorksheet('Changelog', {
    properties: { tabColor: { argb: 'FF8B5CF6' } },
    views: [{ state: 'frozen', ySplit: 2 }],
  });

  cl.mergeCells('A1:D1');
  cl.getCell('A1').value = 'Changelog';
  cl.getCell('A1').font = { name: 'Arial', bold: true, size: 16, color: ACCENT };
  cl.getCell('A1').alignment = { horizontal: 'left', vertical: 'middle' };
  cl.getRow(1).height = 42;

  const clHeaders = ['Date', 'Who', 'What Changed', 'Notes'];
  const clWidths = [14, 18, 48, 48];
  clHeaders.forEach((h, i) => {
    const cell = cl.getCell(2, i + 1);
    cell.value = h;
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = headerAlign;
    cell.border = thinBorder;
    cl.getColumn(i + 1).width = clWidths[i];
  });

  const today = new Date().toISOString().split('T')[0];
  const firstLog = [today, 'Auto-generated', 'Initial backlog exported from LocalVIP dashboard codebase.', `${ROWS.length} items across ${areas.length} areas. All priorities and assignments are blank for team to fill in.`];
  firstLog.forEach((v, i) => {
    const cell = cl.getCell(3, i + 1);
    cell.value = v;
    cell.font = bodyFont;
    cell.alignment = i === 0 ? centerAlign : bodyAlign;
    cell.border = thinBorder;
  });

  // Empty rows for future entries
  for (let r = 4; r <= 25; r++) {
    for (let c = 1; c <= 4; c++) {
      const cell = cl.getCell(r, c);
      cell.value = '';
      cell.border = thinBorder;
      cell.font = bodyFont;
      cell.alignment = c === 1 ? centerAlign : bodyAlign;
    }
  }

  await wb.xlsx.writeFile(OUT);
  console.log(`Saved to ${OUT}`);
}

build().catch(err => { console.error(err); process.exit(1); });

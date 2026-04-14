import * as XLSX from 'xlsx'
import type { QaBacklogRow } from './qa-dashboard-backlog'

/**
 * Export the QA backlog to a fully-formatted .xlsx with:
 *  - Sheet 1: Implementation backlog with Done, Priority, Assigned To, Target Date, Comments, Next Steps
 *  - Sheet 2: Summary dashboard with formulas
 *  - Sheet 3: API inventory broken out per endpoint
 *  - Sheet 4: Changelog
 */
export function exportQaBacklogToExcel(rows: QaBacklogRow[]) {
  const wb = XLSX.utils.book_new()

  // ── Sheet 1: QA Implementation Backlog ──
  const backlogHeaders = [
    '#',
    'Done',
    'Priority',
    'Area',
    'Dashboard Feature',
    'What QA Needs',
    'Needed APIs',
    'Current Status',
    'Assigned To',
    'Target Date',
    'Comments',
    'Next Steps',
  ]

  const backlogData = rows.map((r, i) => [
    i + 1,
    '',               // Done
    '',               // Priority
    r.area,
    r.feature,
    r.qaNeed,
    r.neededApis,
    r.status,
    '',               // Assigned To
    '',               // Target Date
    '',               // Comments
    '',               // Next Steps
  ])

  const ws1 = XLSX.utils.aoa_to_sheet([backlogHeaders, ...backlogData])

  // Column widths
  ws1['!cols'] = [
    { wch: 4 },   // #
    { wch: 8 },   // Done
    { wch: 18 },  // Priority
    { wch: 20 },  // Area
    { wch: 50 },  // Feature
    { wch: 44 },  // QA Needs
    { wch: 44 },  // APIs
    { wch: 26 },  // Status
    { wch: 16 },  // Assigned To
    { wch: 14 },  // Target Date
    { wch: 36 },  // Comments
    { wch: 36 },  // Next Steps
  ]

  // Data validation for Done column (B2:B{end})
  const lastRow = rows.length + 1
  ws1['!dataValidation'] = [
    {
      sqref: `B2:B${lastRow}`,
      type: 'list',
      formula1: '"TRUE,FALSE"',
      allowBlank: true,
    },
    {
      sqref: `C2:C${lastRow}`,
      type: 'list',
      formula1: '"Red - Critical,Orange - High,Yellow - Medium,Green - Low"',
      allowBlank: true,
    },
  ]

  // Autofilter
  ws1['!autofilter'] = { ref: `A1:L${lastRow}` }

  XLSX.utils.book_append_sheet(wb, ws1, 'QA Implementation Backlog')

  // ── Sheet 2: Summary Dashboard ──
  const ref = "'QA Implementation Backlog'"
  const summaryData = [
    ['QA Backlog Summary', ''],
    ['', ''],
    ['Metric', 'Value'],
    ['Total backlog items', { t: 'n', f: `COUNTA(${ref}!A2:A${lastRow})` }],
    ['Items completed (Done = TRUE)', { t: 'n', f: `COUNTIF(${ref}!B2:B${lastRow},"TRUE")` }],
    ['Items remaining', { t: 'n', f: `COUNTA(${ref}!A2:A${lastRow})-COUNTIF(${ref}!B2:B${lastRow},"TRUE")` }],
    ['% Complete', { t: 'n', f: `IF(COUNTA(${ref}!A2:A${lastRow})=0,0,COUNTIF(${ref}!B2:B${lastRow},"TRUE")/COUNTA(${ref}!A2:A${lastRow}))`, z: '0.0%' }],
    ['', ''],
    ['Priority Breakdown', ''],
    ['Red - Critical', { t: 'n', f: `COUNTIF(${ref}!C2:C${lastRow},"Red - Critical")` }],
    ['Orange - High', { t: 'n', f: `COUNTIF(${ref}!C2:C${lastRow},"Orange - High")` }],
    ['Yellow - Medium', { t: 'n', f: `COUNTIF(${ref}!C2:C${lastRow},"Yellow - Medium")` }],
    ['Green - Low', { t: 'n', f: `COUNTIF(${ref}!C2:C${lastRow},"Green - Low")` }],
    ['Not yet prioritized', { t: 'n', f: `COUNTBLANK(${ref}!C2:C${lastRow})` }],
    ['', ''],
    ['Breakdown by Area', ''],
  ]

  const areas = [...new Set(rows.map(r => r.area))].sort()
  areas.forEach((area, i) => {
    const areaRow = summaryData.length + 1
    summaryData.push([area, { t: 'n', f: `COUNTIF(${ref}!D2:D${lastRow},A${areaRow})` }])
  })

  const ws2 = XLSX.utils.aoa_to_sheet(summaryData)
  ws2['!cols'] = [{ wch: 34 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Summary Dashboard')

  // ── Sheet 3: API Inventory ──
  const apiHeaders = ['#', 'Area', 'Endpoint / Action', 'Related Feature', 'Complexity', 'Built?']
  const apiData: (string | number)[][] = []

  let apiIdx = 1
  rows.forEach(r => {
    r.neededApis.split(',').map(e => e.trim().replace(/\.$/, '')).filter(Boolean).forEach(endpoint => {
      apiData.push([apiIdx++, r.area, endpoint, r.feature, '', ''])
    })
  })

  const ws3 = XLSX.utils.aoa_to_sheet([apiHeaders, ...apiData])
  ws3['!cols'] = [
    { wch: 4 },
    { wch: 20 },
    { wch: 44 },
    { wch: 52 },
    { wch: 14 },
    { wch: 10 },
  ]

  const apiLastRow = apiData.length + 1
  ws3['!dataValidation'] = [
    {
      sqref: `E2:E${apiLastRow}`,
      type: 'list',
      formula1: '"Low,Medium,High"',
      allowBlank: true,
    },
    {
      sqref: `F2:F${apiLastRow}`,
      type: 'list',
      formula1: '"YES,NO,IN PROGRESS"',
      allowBlank: true,
    },
  ]
  ws3['!autofilter'] = { ref: `A1:F${apiLastRow}` }

  XLSX.utils.book_append_sheet(wb, ws3, 'API Inventory')

  // ── Sheet 4: Changelog ──
  const today = new Date().toISOString().split('T')[0]
  const changelogData = [
    ['Changelog', '', '', ''],
    ['', '', '', ''],
    ['Date', 'Who', 'What Changed', 'Notes'],
    [today, 'Auto-generated', 'Initial backlog exported from LocalVIP dashboard.', `${rows.length} items across ${areas.length} areas.`],
    ...Array.from({ length: 20 }, () => ['', '', '', '']),
  ]
  const ws4 = XLSX.utils.aoa_to_sheet(changelogData)
  ws4['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 48 }, { wch: 48 }]

  XLSX.utils.book_append_sheet(wb, ws4, 'Changelog')

  // ── Download ──
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `LocalVIP_QA_Backlog_${today}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

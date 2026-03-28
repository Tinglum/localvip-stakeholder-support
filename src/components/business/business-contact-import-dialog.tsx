'use client'

import * as React from 'react'
import { CheckCircle2, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import {
  buildContactImportPreview,
  autoMapContactColumns,
  type BusinessContactImportField,
  type ContactImportMapping,
  IMPORT_IGNORE,
  parseContactSpreadsheetFile,
  parseContactSheet,
} from '@/lib/business-contact-import'

const FIELD_LABELS: Record<BusinessContactImportField, string> = {
  name: 'Name',
  first_name: 'First name',
  last_name: 'Last name',
  phone: 'Phone',
  email: 'Email',
  tag: 'Tag',
}

interface BusinessContactImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessId: string
  profileId: string
  onImported: (count: number) => void
}

export function BusinessContactImportDialog({
  open,
  onOpenChange,
  businessId,
  profileId,
  onImported,
}: BusinessContactImportDialogProps) {
  const supabase = React.useMemo(() => createClient(), [])
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [rawInput, setRawInput] = React.useState('')
  const [sourceLabel, setSourceLabel] = React.useState<string | null>(null)
  const [parseError, setParseError] = React.useState<string | null>(null)
  const [importError, setImportError] = React.useState<string | null>(null)
  const [parsedHeaders, setParsedHeaders] = React.useState<string[]>([])
  const [parsedRows, setParsedRows] = React.useState<string[][]>([])
  const [mapping, setMapping] = React.useState<ContactImportMapping>({
    name: IMPORT_IGNORE,
    first_name: IMPORT_IGNORE,
    last_name: IMPORT_IGNORE,
    phone: IMPORT_IGNORE,
    email: IMPORT_IGNORE,
    tag: IMPORT_IGNORE,
  })
  const [importing, setImporting] = React.useState(false)

  const previewRows = React.useMemo(
    () => buildContactImportPreview({ headers: parsedHeaders, rows: parsedRows, delimiter: 'comma' }, mapping),
    [mapping, parsedHeaders, parsedRows],
  )
  const readyRows = React.useMemo(() => previewRows.filter((row) => row.isReady), [previewRows])
  const skippedRows = previewRows.length - readyRows.length

  const resetState = React.useCallback(() => {
    setRawInput('')
    setSourceLabel(null)
    setParseError(null)
    setImportError(null)
    setParsedHeaders([])
    setParsedRows([])
    setMapping({
      name: IMPORT_IGNORE,
      first_name: IMPORT_IGNORE,
      last_name: IMPORT_IGNORE,
      phone: IMPORT_IGNORE,
      email: IMPORT_IGNORE,
      tag: IMPORT_IGNORE,
    })
    setImporting(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      resetState()
    }
  }

  const buildPreview = React.useCallback((text: string, label?: string | null) => {
    setParseError(null)
    setImportError(null)

    const parsedSheet = parseContactSheet(text)
    if (!parsedSheet.headers.length || !parsedSheet.rows.length) {
      setParsedHeaders([])
      setParsedRows([])
      setMapping({
        name: IMPORT_IGNORE,
        first_name: IMPORT_IGNORE,
        last_name: IMPORT_IGNORE,
        phone: IMPORT_IGNORE,
        email: IMPORT_IGNORE,
        tag: IMPORT_IGNORE,
      })
      setParseError('Add a header row plus at least one contact row to preview this import.')
      return
    }

    setParsedHeaders(parsedSheet.headers)
    setParsedRows(parsedSheet.rows)
    setMapping(autoMapContactColumns(parsedSheet.headers))
    setSourceLabel(label || null)
  }, [])

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const parsedSheet = await parseContactSpreadsheetFile(file)
      setParseError(null)
      setImportError(null)
      setSourceLabel(file.name)

      if (!parsedSheet.headers.length || !parsedSheet.rows.length) {
        setParsedHeaders([])
        setParsedRows([])
        setMapping({
          name: IMPORT_IGNORE,
          first_name: IMPORT_IGNORE,
          last_name: IMPORT_IGNORE,
          phone: IMPORT_IGNORE,
          email: IMPORT_IGNORE,
          tag: IMPORT_IGNORE,
        })
        setParseError('Add a header row plus at least one contact row to preview this import.')
        return
      }

      setParsedHeaders(parsedSheet.headers)
      setParsedRows(parsedSheet.rows)
      setMapping(autoMapContactColumns(parsedSheet.headers))
      setRawInput('')
    } catch {
      setParseError('That file could not be read. Try Excel, CSV, TSV, or paste your sheet directly.')
    }
  }

  const handlePreview = () => {
    buildPreview(rawInput, sourceLabel)
  }

  const handleImport = async () => {
    setImportError(null)

    if (!readyRows.length) {
      setImportError('There are no ready rows to import yet.')
      return
    }

    setImporting(true)
    let successCount = 0
    let failureCount = 0

    for (const row of readyRows) {
      const { error } = await (supabase.from('contacts') as any)
        .insert({
          first_name: row.firstName,
          last_name: row.lastName || '',
          phone: row.phone || null,
          email: row.email || null,
          business_id: businessId,
          owner_id: profileId,
          created_by_user_id: profileId,
          source: 'Bulk import',
          tag: row.tag || null,
          list_status: 'added',
          invited_at: null,
          joined_at: null,
          status: 'active',
          metadata: {
            tag: row.tag || null,
            imported_via: sourceLabel || 'sheet_import',
            import_row_number: row.rowNumber,
          },
        })

      if (error) {
        failureCount += 1
      } else {
        successCount += 1
      }
    }

    setImporting(false)

    if (!successCount) {
      setImportError('None of the contacts could be imported. Please check the column mapping and try again.')
      return
    }

    onImported(successCount)
    handleOpenChange(false)

    if (failureCount) {
      setImportError(`${failureCount} rows could not be imported.`)
    }
  }

  const rawPreviewRows = parsedRows.slice(0, 6)
  const interpretedPreviewRows = previewRows.slice(0, 8)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Import contacts from Excel, Google Sheets, or CSV</DialogTitle>
          <DialogDescription>
            Paste rows directly from Excel or Google Sheets, or upload a CSV file. We will detect the headers, let you map the columns, and show you exactly what will be imported before anything is saved.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  Upload file
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv,.txt,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {sourceLabel && <span className="text-sm text-surface-500">{sourceLabel}</span>}
              </div>
              <p className="mt-3 text-sm leading-6 text-surface-500">
                Upload an Excel, CSV, TSV, or text file here, or paste rows directly from Excel or Google Sheets below. Best headers are <span className="font-medium text-surface-800">Name</span>, <span className="font-medium text-surface-800">Phone</span>, <span className="font-medium text-surface-800">Email</span>, and <span className="font-medium text-surface-800">Tag</span>. If your sheet uses <span className="font-medium text-surface-800">First Name</span> and <span className="font-medium text-surface-800">Last Name</span> instead of one name column, we handle that too.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-surface-700">Paste your sheet</label>
              <Textarea
                value={rawInput}
                onChange={(event) => setRawInput(event.target.value)}
                rows={10}
                placeholder={'Name\tPhone\tEmail\tTag\nJordan Smith\t(404) 555-0131\tjordan@email.com\tRegular\nLisa Adams\t\tlisa@email.com\tFriend'}
              />
              <p className="mt-2 text-xs leading-5 text-surface-400">
                Tip: you can copy rows directly out of Excel or Google Sheets and paste them here.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={handlePreview}>
                <FileSpreadsheet className="h-4 w-4" />
                Preview import
              </Button>
              <Button type="button" variant="outline" onClick={resetState}>
                Clear
              </Button>
            </div>

            {parseError && <p className="text-sm text-danger-600">{parseError}</p>}
            {importError && <p className="text-sm text-danger-600">{importError}</p>}
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <ImportMetric label="Rows detected" value={parsedRows.length} />
              <ImportMetric label="Ready to import" value={readyRows.length} />
              <ImportMetric label="Skipped" value={skippedRows} />
            </div>

            {!!parsedHeaders.length && (
              <div className="rounded-2xl border border-surface-200 bg-white p-4">
                <p className="text-sm font-semibold text-surface-900">Column mapping</p>
                <p className="mt-1 text-sm text-surface-500">
                  We auto-detect the likely columns first. You can override any of them below.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {(Object.keys(FIELD_LABELS) as BusinessContactImportField[]).map((field) => (
                    <div key={field} className="space-y-1.5">
                      <label className="block text-sm font-medium text-surface-700">{FIELD_LABELS[field]}</label>
                      <Select value={mapping[field]} onValueChange={(value) => setMapping((current) => ({ ...current, [field]: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Ignore this field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={IMPORT_IGNORE}>Ignore this field</SelectItem>
                          {parsedHeaders.map((header, index) => (
                            <SelectItem key={`${field}-${header}-${index}`} value={String(index)}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50 px-3 py-3 text-sm text-brand-800">
                  If both <span className="font-medium">First name</span> and <span className="font-medium">Last name</span> are mapped, we combine them automatically. If a single <span className="font-medium">Name</span> column is mapped, we split it intelligently for you.
                </div>
              </div>
            )}

            {!!parsedHeaders.length && (
              <div className="rounded-2xl border border-surface-200 bg-white p-4">
                <p className="text-sm font-semibold text-surface-900">Detected sheet</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-surface-200 bg-surface-50 text-surface-600">
                        {parsedHeaders.map((header) => (
                          <th key={header} className="px-3 py-2 font-medium">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rawPreviewRows.map((row, index) => (
                        <tr key={`raw-${index}`} className="border-b border-surface-100">
                          {parsedHeaders.map((_, cellIndex) => (
                            <td key={`raw-${index}-${cellIndex}`} className="px-3 py-2 text-surface-700">
                              {row[cellIndex] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!!previewRows.length && (
              <div className="rounded-2xl border border-surface-200 bg-white p-4">
                <p className="text-sm font-semibold text-surface-900">What will import</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-surface-200 bg-surface-50 text-surface-600">
                        <th className="px-3 py-2 font-medium">Name</th>
                        <th className="px-3 py-2 font-medium">Phone</th>
                        <th className="px-3 py-2 font-medium">Email</th>
                        <th className="px-3 py-2 font-medium">Tag</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {interpretedPreviewRows.map((row) => (
                        <tr key={`preview-${row.rowNumber}`} className="border-b border-surface-100">
                          <td className="px-3 py-2 text-surface-900">{row.fullName || '—'}</td>
                          <td className="px-3 py-2 text-surface-700">{row.phone || '—'}</td>
                          <td className="px-3 py-2 text-surface-700">{row.email || '—'}</td>
                          <td className="px-3 py-2 text-surface-700">{row.tag || '—'}</td>
                          <td className="px-3 py-2">
                            {row.isReady ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-xs font-medium text-success-700">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Ready
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                                {row.issue}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleImport()} disabled={importing || !readyRows.length}>
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Import {readyRows.length} contacts
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ImportMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-surface-900">{value}</p>
    </div>
  )
}

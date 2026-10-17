import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MaterialsStep } from '../src/components/community/cause-setup-steps'

// An isolated preview: no login, backend writes, emails, or render requests.
const directory = resolve(process.argv[2] || 'tmp/render-status-preview')
mkdirSync(directory, { recursive: true })
const css = readFileSync(resolve(directory, 'styles.css'), 'utf8')
const sections = [
  { title: 'Rendering materials', count: 5, busy: true, startedAt: new Date(Date.now() - 96000).toISOString(), progress: '15-second cut: Video and poster ready · 60-second film: Rendering cause video (38%)', error: null },
  { title: 'Materials ready', count: 12, busy: false, progress: '60-second film: Video and poster ready. Publish the landing draft to update your page.', error: null },
  { title: 'Partial generation', count: 5, busy: false, progress: '5 of 12 flyers generated.', error: 'Video rendered, but its poster failed. Retry generation to create both files.' },
]
const html = renderToStaticMarkup(<main className="mx-auto max-w-4xl space-y-8 p-4 sm:p-8">{sections.map(section => <section key={section.title} className="rounded-2xl border border-surface-200 bg-white p-4 sm:p-6"><h1 className="mb-5 text-xl font-bold">{section.title}</h1><MaterialsStep {...section} onGenerate={() => {}} /></section>)}</main>)
writeFileSync(resolve(directory, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><title>Materials generation preview</title><style>${css}</style></head><body>${html}</body></html>`)
console.log(resolve(directory, 'index.html'))

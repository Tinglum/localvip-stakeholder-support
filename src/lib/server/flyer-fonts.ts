import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * The font files behind the flyer templates' CSS stacks
 * (display: 'DejaVu Sans', 'Arial Black', Arial; sans: 'DejaVu Sans', Arial).
 * resvg renders the PDF with these, the server measures with them, and the
 * generator's live preview loads the same files, so all three agree.
 */
export type FlyerFontFace = { key: string; family: string; weight: number; file: string }

const CANDIDATES: Array<Omit<FlyerFontFace, 'file'> & { names: string[] }> = [
  { key: 'dejavu-sans', family: 'DejaVu Sans', weight: 400, names: ['DejaVuSans.ttf'] },
  { key: 'dejavu-sans-bold', family: 'DejaVu Sans', weight: 700, names: ['DejaVuSans-Bold.ttf'] },
  { key: 'arial-black', family: 'Arial Black', weight: 900, names: ['ariblk.ttf', 'Arial Black.ttf', 'Arial_Black.ttf'] },
  { key: 'arial', family: 'Arial', weight: 400, names: ['arial.ttf', 'Arial.ttf'] },
  { key: 'arial-bold', family: 'Arial', weight: 700, names: ['arialbd.ttf', 'Arial Bold.ttf', 'Arial_Bold.ttf'] },
]
const FONT_DIRS = ['/usr/share/fonts', '/usr/local/share/fonts', '/Library/Fonts', '/System/Library/Fonts/Supplemental',
  path.join(process.env.WINDIR || 'C:/Windows', 'Fonts')]
// Arial-metric fallback that ships with the app, used only when the system has neither family.
const BUNDLED = path.join(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts')

function findFile(names: string[]) {
  const wanted = new Set(names.map(name => name.toLowerCase()))
  const visit = (dir: string, depth: number): string | undefined => {
    let entries: string[]
    try { entries = readdirSync(dir) } catch { return undefined }
    for (const entry of entries) if (wanted.has(entry.toLowerCase())) return path.join(dir, entry)
    if (depth === 0) return undefined
    for (const entry of entries) {
      const child = path.join(dir, entry)
      try { if (statSync(child).isDirectory()) { const found = visit(child, depth - 1); if (found) return found } } catch { /* unreadable */ }
    }
    return undefined
  }
  for (const dir of FONT_DIRS) { const found = visit(dir, 3); if (found) return found }
  return undefined
}

let resolved: { faces: FlyerFontFace[]; display: string; sans: string } | undefined
export function flyerFonts() {
  if (resolved) return resolved
  const found = CANDIDATES.flatMap(({ names, ...face }) => { const file = findFile(names); return file ? [{ ...face, file }] : [] })
  const has = (key: string) => found.some(face => face.key === key)
  // The first family in each CSS stack that is installed is the one resvg uses.
  const dejavu = has('dejavu-sans') && has('dejavu-sans-bold')
  const display = dejavu ? 'DejaVu Sans' : has('arial-black') ? 'Arial Black' : 'Arial'
  const sans = dejavu ? 'DejaVu Sans' : 'Arial'
  const faces = found.filter(face => face.family === display || face.family === sans)
  if (!faces.some(face => face.family === 'Arial') && !dejavu) {
    // Neither family is installed: serve the bundled metric-compatible face as Arial.
    for (const [key, file, weight] of [['liberation-sans', 'LiberationSans-Regular.ttf', 400], ['liberation-sans-bold', 'LiberationSans-Bold.ttf', 700]] as const) {
      const full = path.join(BUNDLED, file)
      if (existsSync(full)) faces.push({ key, family: 'Arial', weight, file: full })
    }
  }
  resolved = { faces, display, sans }
  return resolved
}

// The GiveBack Days design ships its own faces (SIL OFL, licences alongside),
// so it sets identically on every server and in every browser.
const GIVEBACK_DIR = path.join(process.cwd(), 'src/lib/server/flyer-templates/giveback')
const GIVEBACK_FONTS = {
  display: 'Montserrat',
  sans: 'Open Sans',
  faces: [
    { key: 'montserrat-700', family: 'Montserrat', weight: 700, file: path.join(GIVEBACK_DIR, 'Montserrat-700.ttf') },
    { key: 'montserrat-800', family: 'Montserrat', weight: 800, file: path.join(GIVEBACK_DIR, 'Montserrat-800.ttf') },
    { key: 'open-sans-400', family: 'Open Sans', weight: 400, file: path.join(GIVEBACK_DIR, 'OpenSans-400.ttf') },
    { key: 'open-sans-700', family: 'Open Sans', weight: 700, file: path.join(GIVEBACK_DIR, 'OpenSans-700.ttf') },
  ] as FlyerFontFace[],
}
export const givebackFonts = () => GIVEBACK_FONTS

export const flyerFontFace = (key: string) => [...flyerFonts().faces, ...GIVEBACK_FONTS.faces].find(face => face.key === key)

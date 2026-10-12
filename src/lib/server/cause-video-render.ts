/**
 * Rendering the cause videos, off the request thread.
 *
 * WHY THIS IS NOT A PLAIN `await fetch(...)` ANY MORE
 * ---------------------------------------------------
 * The renderer worker renders at `concurrency: 1`. Measured on an idle dev box,
 * same props, same code path as the worker:
 *
 *   CauseLaunchVideo (15s,  450 frames)  ->  40.5s  (38.0s video + 1.3s still)
 *   CauseGiveback60  (60s, 1800 frames)  -> 196.4s (193.1s video + 1.5s still)
 *
 * The 60-second film is 4.85x the 15-second cut, and 196s is already most of the
 * old 240s request timeout - on an idle machine, with a warm bundle (a cold one
 * adds ~12s) and nothing else running. In production the same box serves
 * dashboard.localvip.com and my.localvip.com, so the real number is higher and
 * variable. The route that drives all of this is capped at `maxDuration = 300`
 * and spends a chunk of that budget rendering three PDF flyers before the video
 * is even requested.
 *
 * So a synchronous HTTP render is the wrong shape for the 60. If it overran, the
 * dashboard aborted, the operator saw "failed", and the worker kept burning a
 * core on a file nobody would ever collect - the result URL only exists in the
 * HTTP response we just hung up on.
 *
 * The honest fix, without touching the worker: stop making anyone wait. The
 * render runs as a background job in this process, the request returns
 * `rendering` immediately, and the next status poll reconciles. The job's own
 * fetch timeout is generous (10 minutes) because nothing is blocked on it, and
 * it is still bounded so a wedged worker cannot leak the job forever.
 *
 * Still worth a human's attention: the registry is in-process, like the existing
 * per-cause launch queue. A dashboard restart mid-render forgets the job, and
 * since the worker has no way to report a finished render other than its HTTP
 * response, that render is lost; the next operator action re-renders it. A
 * worker that returned a job id and could be polled would fix that properly.
 */

type Json = <T>(path: string, init?: RequestInit, message?: string) => Promise<T | null>

export type CauseVideoCut = 'short' | 'feature'

type CutSpec = {
  /** Composition id on the worker. Absent means the worker's default, the 15s. */
  composition?: 'CauseGiveback60'
  label: string
  /** Where the result lands in the landing draft. */
  field: 'video' | 'shortVideo'
  sourceField: 'videoSource' | 'shortVideoSource'
  /**
   * Fingerprint prefix. `short` keeps the historical `qr-v3` prefix so a cause
   * whose 15s was rendered before this change is recognised as already current
   * once it has been migrated into `shortVideo`.
   */
  versionPrefix: string
  /** How long to let the worker have before giving up on this render. */
  timeoutMs: number
  /** Roughly how long to tell the operator it will take. */
  etaText: string
}

export const CAUSE_VIDEO_CUTS: Record<CauseVideoCut, CutSpec> = {
  short: {
    label: '15-second cut',
    field: 'shortVideo',
    sourceField: 'shortVideoSource',
    versionPrefix: 'qr-v3',
    timeoutMs: 240_000,
    etaText: 'about a minute',
  },
  feature: {
    composition: 'CauseGiveback60',
    label: '60-second film',
    field: 'video',
    sourceField: 'videoSource',
    versionPrefix: 'giveback60-v1',
    timeoutMs: 600_000,
    etaText: 'three to five minutes',
  },
}

export type CauseVideoProps = {
  accountId: number
  causeName: string
  kind: 'school' | 'cause'
  locality: string
  logoUrl: string
  coverPhotoUrl: string
  photos: Record<string, string>
  joinUrl: string
}

export const causeVideoVersion = (cut: CauseVideoCut, props: CauseVideoProps, photoSlots: readonly string[]) =>
  [CAUSE_VIDEO_CUTS[cut].versionPrefix, props.logoUrl, ...photoSlots.map((slot) => props.photos[slot] || ''), props.joinUrl].join('|')

export type CauseVideoJobState = { status: 'rendering' | 'failed'; cut: CauseVideoCut; detail: string }

type Want = { version: string; props: CauseVideoProps; request: Json; landingPath: string }

const wanted = new Map<string, Want>()
const running = new Map<string, Promise<void>>()
const lastFailure = new Map<string, string>()

const key = (causeId: number, cut: CauseVideoCut) => `${causeId}:${cut}`
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** A 429 from the busy worker: worth waiting for rather than failing. */
class Retryable extends Error {}

async function postRender(cut: CauseVideoCut, props: CauseVideoProps) {
  const renderUrl = process.env.CAUSE_VIDEO_RENDER_URL
  const renderToken = process.env.CAUSE_VIDEO_RENDER_TOKEN
  if (!renderUrl || !renderToken) throw new Error('Set CAUSE_VIDEO_RENDER_URL and CAUSE_VIDEO_RENDER_TOKEN to connect the renderer.')
  const spec = CAUSE_VIDEO_CUTS[cut]
  let response: Response
  try {
    response = await fetch(`${renderUrl.replace(/\/$/, '')}/render`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${renderToken}` },
      body: JSON.stringify({
        accountId: props.accountId,
        causeName: props.causeName,
        kind: props.kind,
        locality: props.locality,
        logoUrl: props.logoUrl,
        // `coverPhotoUrl` is the worker's compatibility alias for photos.crowd.
        coverPhotoUrl: props.coverPhotoUrl,
        photos: props.photos,
        joinUrl: props.joinUrl,
        // Omitting it would mean the 15s, so only the 60s names itself.
        ...(spec.composition ? { composition: spec.composition } : {}),
      }),
      signal: AbortSignal.timeout(spec.timeoutMs),
    })
  } catch (error) {
    // A timeout here means the worker is probably still rendering something we
    // will never collect. Retrying immediately would only earn a 429, so report
    // it and let the next operator action start a fresh render.
    throw new Error(error instanceof Error && error.name === 'TimeoutError'
      ? `The renderer did not finish the ${spec.label} within ${Math.round(spec.timeoutMs / 60_000)} minutes.`
      : error instanceof Error ? error.message : String(error))
  }
  // The worker serialises renders and 429s while one is in flight.
  if (response.status === 429) throw new Retryable('Renderer is busy.')
  const rendered = await response.json() as { src?: string; poster?: string; error?: string }
  if (!response.ok || !rendered.src || !rendered.poster) throw new Error(rendered.error || `${spec.label} render failed.`)
  return { src: rendered.src, poster: rendered.poster }
}

/**
 * Attach a finished render to the landing DRAFT. Re-reads the draft first: the
 * render took minutes and the cause may have edited the page meanwhile, so the
 * only safe base is whatever is stored now.
 *
 * Writing the draft never changes what the public sees - an already-live page
 * keeps serving its published revision until the cause publishes again. The
 * status endpoint is what surfaces that, so nothing here claims the video is
 * live.
 */
async function attach(want: Want, cut: CauseVideoCut, rendered: { src: string; poster: string }) {
  const spec = CAUSE_VIDEO_CUTS[cut]
  const record = await want.request<{ draft?: unknown }>(want.landingPath)
  const draft = record?.draft as Record<string, unknown> | null
  if (!draft?.slug) throw new Error('Landing draft is missing; the video could not be attached.')
  await want.request(want.landingPath, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      slug: draft.slug,
      config: { ...draft, [spec.field]: rendered, [spec.sourceField]: want.version },
    }),
  })
}

async function drain(causeId: number, cut: CauseVideoCut) {
  const id = key(causeId, cut)
  for (let pass = 0; pass < 4; pass += 1) {
    const want = wanted.get(id)
    if (!want) return
    // Claim it before rendering. Anything that changes the fingerprint while we
    // render re-populates this slot, so a cause uploading four photos one at a
    // time gets this render plus ONE more for the final set, not four renders.
    wanted.delete(id)
    try {
      await attach(want, cut, await postRender(cut, want.props))
      lastFailure.delete(id)
    } catch (error) {
      if (error instanceof Retryable) {
        // Do not stack a second render on a busy worker: put it back and wait.
        if (!wanted.has(id)) wanted.set(id, want)
        await sleep(45_000)
        continue
      }
      const detail = error instanceof Error ? error.message : String(error)
      lastFailure.set(id, detail)
      console.error(`[cause-video] ${cut} render for cause ${causeId} failed: ${detail}`)
      return
    }
  }
}

/**
 * Ensure a render for `want.version` is in flight, and return immediately.
 *
 * Idempotent per (cause, cut): calling it again while the same version renders
 * only refreshes the target, and a newer version supersedes an unstarted one.
 */
export function requestCauseVideoRender(causeId: number, cut: CauseVideoCut, want: Want): CauseVideoJobState {
  const id = key(causeId, cut)
  wanted.set(id, want)
  lastFailure.delete(id)
  if (!running.has(id)) {
    const run = drain(causeId, cut).finally(() => { if (running.get(id) === run) running.delete(id) })
    running.set(id, run)
    // Deliberately not awaited by the caller; `drain` reports its own failures.
    void run
  }
  return causeVideoJobState(causeId, cut) || { status: 'rendering', cut, detail: renderingDetail(cut) }
}

const renderingDetail = (cut: CauseVideoCut) =>
  `The ${CAUSE_VIDEO_CUTS[cut].label} is rendering - ${CAUSE_VIDEO_CUTS[cut].etaText}. Reopen this page to pick it up.`

/** What to say about a cut that has no up-to-date video stored yet. */
export function causeVideoJobState(causeId: number, cut: CauseVideoCut): CauseVideoJobState | null {
  const id = key(causeId, cut)
  if (running.has(id) || wanted.has(id)) return { status: 'rendering', cut, detail: renderingDetail(cut) }
  const failure = lastFailure.get(id)
  return failure ? { status: 'failed', cut, detail: failure } : null
}

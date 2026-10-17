import assert from 'node:assert/strict'
import test from 'node:test'
import { queueDurableVideo, reconcileDurableVideos, type RenderJob } from '../src/lib/server/cause-video-durable'
import { getConsumerWebappBaseUrl as campaignAppOrigin } from '../src/lib/material-engine'
import { causeVideoVersion, type CauseVideoProps } from '../src/lib/server/cause-video-render'

test('durable video job survives a fresh collector and preserves landing edits', async () => {
  const savedFetch = globalThis.fetch
  const savedUrl = process.env.CAUSE_VIDEO_RENDER_URL
  const savedToken = process.env.CAUSE_VIDEO_RENDER_TOKEN
  const savedApp = process.env.NEXT_PUBLIC_WEBAPP_URL
  process.env.CAUSE_VIDEO_RENDER_URL = 'https://renderer.test'
  process.env.CAUSE_VIDEO_RENDER_TOKEN = 'test-only'
  process.env.NEXT_PUBLIC_WEBAPP_URL = 'https://my-qa.localvip.com/'
  let config: Record<string, unknown> = { slug: 'test-school', mission: 'Original mission' }
  const job: RenderJob = {
    id: '12345678-1234-1234-1234-123456789012', accountId: 42, composition: 'CauseGiveback60',
    status: 'queued', stage: 'Waiting', progress: 0, startedAt: null, completedAt: null,
    createdAt: '2026-10-17T10:00:00.000Z', elapsedSeconds: 0, estimateSeconds: [180, 300],
  }
  let renderRequests = 0
  const request = async <T>(_path: string, init?: RequestInit): Promise<T> => {
    if (init?.method === 'PUT') config = JSON.parse(String(init.body)).config
    return { status: 'published', draft: structuredClone(config) } as T
  }
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /^https:\/\/renderer.test\/jobs/)
    assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer test-only')
    if (init?.method === 'POST') {
      renderRequests++
      assert.ok((init.headers as Record<string, string>)['idempotency-key'])
    }
    return Response.json(job)
  }
  const props: CauseVideoProps = {accountId: 42, causeName: 'Test School', kind: 'school', locality: 'Olathe', logoUrl: 'https://test/logo.png', coverPhotoUrl: 'https://test/photo.jpg', photos: {}, joinUrl: 'https://my-qa.localvip.com/go/campaign/test-school/families', primaryColor: '#B12929'}
  try {
    assert.equal(campaignAppOrigin(), 'https://my-qa.localvip.com')
    assert.notEqual(causeVideoVersion('feature', props, []), causeVideoVersion('feature', {...props, primaryColor: '#000000'}, []))
    await queueDurableVideo(42, 'feature', {version: 'current-version', props, request, landingPath: '/landing'})
    await queueDurableVideo(42, 'feature', {version: 'current-version', props, request, landingPath: '/landing'})
    assert.equal(renderRequests, 1)
    config.mission = 'Edited while rendering'
    job.status = 'completed'
    job.result = {src: 'https://renderer.test/video.mp4', poster: 'https://renderer.test/poster.png'}
    const result = await reconcileDurableVideos(42, {draft: structuredClone(config), status: 'published'}, request)
    assert.equal(config.mission, 'Edited while rendering')
    assert.deepEqual(config.video, job.result)
    assert.equal(config.videoSource, 'current-version')
    assert.equal(result.record?.status, 'published_with_changes')
    // A later generation replaces the reference while the previous GET is in flight.
    const stale = structuredClone(config)
    delete config.video
    config.videoJobs = { feature: {id: 'new-job', version: 'new-version'} }
    await reconcileDurableVideos(42, {draft: stale}, request)
    assert.equal(config.video, undefined)
  } finally {
    globalThis.fetch = savedFetch
    for (const [name, value] of Object.entries({CAUSE_VIDEO_RENDER_URL: savedUrl, CAUSE_VIDEO_RENDER_TOKEN: savedToken, NEXT_PUBLIC_WEBAPP_URL: savedApp})) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value
    }
  }
})

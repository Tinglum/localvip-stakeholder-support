import assert from 'node:assert/strict'
import test from 'node:test'
import {NextRequest} from 'next/server'
import {updateSession} from '../src/lib/supabase/middleware'
import {GET} from '../src/app/api/cause-video/generated/[file]/route'

test('public generated videos play without a dashboard session while private jobs stay protected', async()=>{
  const media=await updateSession(new NextRequest('https://qa.example.test/api/cause-video/generated/cause-42-12345678.mp4'))
  assert.equal(media.headers.get('location'),null)
  const privatePage=await updateSession(new NextRequest('https://qa.example.test/community/setup'))
  assert.match(privatePage.headers.get('location') || '',/\/login/)
})

test('media proxy streams only allowed filenames from the configured worker',async()=>{
  const previousFetch=globalThis.fetch, previousBase=process.env.CAUSE_VIDEO_RENDER_URL
  process.env.CAUSE_VIDEO_RENDER_URL='http://127.0.0.1:4320'
  let requests=0
  globalThis.fetch=async(url,init)=>{
    requests++; assert.equal(String(url),'http://127.0.0.1:4320/generated/cause-42-12345678.mp4')
    assert.equal(init?.headers,undefined)
    return new Response(new Uint8Array([1,2,3]),{headers:{'content-length':'3'}})
  }
  try {
    assert.equal((await GET(new Request('https://qa.example.test'),{params:{file:'../../.env'}})).status,404)
    assert.equal(requests,0)
    const video=await GET(new Request('https://qa.example.test'),{params:{file:'cause-42-12345678.mp4'}})
    assert.equal(video.status,200);assert.equal(video.headers.get('content-type'),'video/mp4')
    assert.equal((await video.arrayBuffer()).byteLength,3)
  } finally {globalThis.fetch=previousFetch;if(previousBase===undefined)delete process.env.CAUSE_VIDEO_RENDER_URL;else process.env.CAUSE_VIDEO_RENDER_URL=previousBase}
})

import assert from 'node:assert/strict'
import test from 'node:test'
import {mkdtempSync, readFileSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {materialJobStore, publicMaterialJob} from '../src/lib/server/material-job-store'
import {advanceMaterialJob} from '../src/lib/server/material-job-runner'
import {getCauseLaunchStatus} from '../src/lib/server/cause-launch-materials'
import {QA_AUTH_CONFIG} from '../src/lib/auth/qa-auth'

test('batch persists every flyer, survives reopening, and notifies only after all files complete', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'localvip-materials-'))
  t.after(() => rmSync(directory, {recursive:true,force:true}))
  const store = materialJobStore(directory, 'test-secret')
  const cause = {id:42,name:'Test School'}
  const {job} = store.enqueue(cause, 'test-access-token')
  assert.equal(store.enqueue(cause, 'another-token').reused, true)
  assert.equal(readFileSync(join(directory,'cause-42.json'),'utf8').includes('test-access-token'), false)
  assert.equal('accessToken' in publicMaterialJob(job), false)
  let notifications = 0
  const deps = {
    save: store.save,
    generate: async (progress: (count:number,stage:string,version:string)=>void) => {
      for (let i=1;i<=12;i++) {
        progress(i, `Creating flyers: ${i}/12 ready`, 'current')
        assert.equal(materialJobStore(directory,'test-secret').read(42)?.flyerCount,i)
      }
      return {steps:{landingPages:{status:'draft'},flyers:{status:'generated'},video:{status:'rendering'}}}
    },
    status: async () => ({video:'rendering',shortVideo:'generated'}),
    notify: async () => {notifications++;return {available:true}},
  }
  await advanceMaterialJob(job,deps)
  assert.equal(job.status,'rendering_video')
  assert.equal(notifications,0)
  const restarted = materialJobStore(directory,'test-secret').read(42)!
  await advanceMaterialJob(restarted,{...deps,generate:async()=>assert.fail('Already saved flyer batch was rerendered'),status:async()=>({video:'generated',shortVideo:'generated'})})
  assert.equal(restarted.status,'completed')
  assert.equal(restarted.notification,'sent')
  assert.equal(store.read(42)?.accessToken,'')
  await advanceMaterialJob(restarted,deps)
  assert.equal(notifications,1)
})

test('failed flyer batches keep partial progress and never announce success', async t => {
  const directory = mkdtempSync(join(tmpdir(),'localvip-materials-'))
  t.after(()=>rmSync(directory,{recursive:true,force:true}))
  const store=materialJobStore(directory,'secret')
  const {job}=store.enqueue({id:43,name:'Cause'},'token')
  await advanceMaterialJob(job,{
    save:store.save,
    generate:async progress=>{progress(4,'4/12 flyers ready','version');throw new Error('Upload failed. Retry to resume.')},
    status:async()=>assert.fail('Failed batch checked video'),notify:async()=>assert.fail('Failed batch notified success'),
  })
  assert.equal(job.status,'partial')
  assert.equal(job.flyerCount,4)
  assert.match(job.error!,/Upload failed/)
  assert.equal(store.enqueue({id:43,name:'Cause'},'new-token').reused,false)
})

test('notification failure preserves completed files and is retried', async t => {
  const directory=mkdtempSync(join(tmpdir(),'localvip-materials-'))
  t.after(()=>rmSync(directory,{recursive:true,force:true}))
  const store=materialJobStore(directory,'secret')
  const {job}=store.enqueue({id:44,name:'Cause'},'token')
  job.status='completed';job.flyerCount=12
  const deps={save:store.save,generate:async()=>assert.fail(),status:async()=>assert.fail(),notify:async()=>{throw new Error('Connection dropped')}}
  await advanceMaterialJob(job,deps)
  assert.equal(job.status,'completed');assert.equal(job.notification,'pending')
  await advanceMaterialJob(job,{...deps,notify:async()=>({available:false})})
  assert.equal(job.notification,'unavailable')
})

test('progress exposes only current saved flyers and resolves local upload URLs', async () => {
  const previous=process.env.CAUSE_MATERIAL_JOBS_ENABLED
  process.env.CAUSE_MATERIAL_JOBS_ENABLED='1'
  const metadata={generator:'cause-campaign-v1',version:'approved-library-v8|current',audience:'business',design:'community'}
  const request=async <T>(path:string):Promise<T> => (path.endsWith('/landing-page') ? {draft:{}} : {items:[
    {generatedFileUrl:'/uploads/materials/cause-launch/ready.pdf',metadata},
    {generatedFileUrl:'/uploads/materials/cause-launch/old.pdf',metadata:{...metadata,version:'old'}},
    {generatedFileUrl:'/uploads/materials/cause-launch/failed.pdf',generationStatus:'failed',metadata:{...metadata,audience:'families'}},
  ]}) as T
  try {
    const status=await getCauseLaunchStatus(42,request,metadata.version)
    assert.equal(status.readyFlyers?.length,1)
    assert.equal(status.readyFlyers?.[0].url,`${QA_AUTH_CONFIG.baseUrl}/uploads/materials/cause-launch/ready.pdf`)
  } finally {if(previous===undefined)delete process.env.CAUSE_MATERIAL_JOBS_ENABLED;else process.env.CAUSE_MATERIAL_JOBS_ENABLED=previous}
})

test('an older completion callback cannot overwrite a newly requested batch', t => {
  const directory=mkdtempSync(join(tmpdir(),'localvip-materials-'))
  t.after(()=>rmSync(directory,{recursive:true,force:true}))
  const store=materialJobStore(directory,'secret')
  const old=store.enqueue({id:45,name:'Cause'},'old-token').job
  old.status='completed';store.save(old)
  const next=store.enqueue({id:45,name:'Cause'},'new-token').job
  old.notification='sent';store.save(old)
  assert.equal(store.read(45)?.id,next.id)
  assert.equal(store.read(45)?.status,'queued')
})

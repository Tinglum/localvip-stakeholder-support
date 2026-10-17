import { NextResponse } from 'next/server'
import { getOperatorRouteContext } from '@/lib/server/operator-access'
import { fetchQaCauseDetail } from '@/lib/server/qa-dashboard-causes'
import { getCauseLaunchStatus } from '@/lib/server/cause-launch-materials'
import { getQaAccessToken } from '@/lib/auth/qa-api'
import { getMaterialJobStore, startMaterialWorker } from '@/lib/server/material-job-runner'
import { publicMaterialJob } from '@/lib/server/material-job-store'
import { fetchPortalCauseAccounts } from '@/lib/server/portal-cause'

export const runtime = 'nodejs'
export const maxDuration = 300

async function context(id: string) {
  const operator = await getOperatorRouteContext(['admin', 'field', 'launch_partner', 'community'])
  if ('error' in operator) return { error: operator.error }
  if (!operator.session.qaSession) return { error: NextResponse.json({ error: 'A QA session is required.' }, { status: 401 }) }
  if (!/^[1-9]\d*$/.test(id)) return { error: NextResponse.json({ error: 'A linked cause account is required.' }, { status: 400 }) }
  if (operator.shell === 'community') {
    const userId = operator.session.viewingAs?.targetUserId ?? Number(operator.session.localProfileId)
    const accounts = Number.isInteger(userId) && userId > 0 ? await fetchPortalCauseAccounts(userId) : null
    if (!accounts?.some(account => account.accountId === Number(id))) {
      return { error: NextResponse.json({ error: 'This cause is not linked to your account.' }, { status: 403 }) }
    }
  }
  return { id: Number(id) }
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const authorized = await context(params.id)
  if ('error' in authorized) return authorized.error
  try {
    const job = process.env.CAUSE_MATERIAL_JOBS_ENABLED === '1' ? getMaterialJobStore().read(authorized.id) : null
    const status = await getCauseLaunchStatus(authorized.id, undefined, job?.flyerVersion || undefined)
    return NextResponse.json({ ...status, ...(job && !job.flyerVersion ? {readyFlyers: []} : {}), generation: job ? publicMaterialJob(job) : null }, {headers: {'cache-control': 'no-store'}})
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load launch status.' }, { status: 502 })
  }
}

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const authorized = await context(params.id)
  if ('error' in authorized) return authorized.error
  try {
    if (process.env.CAUSE_MATERIAL_JOBS_ENABLED !== '1' || process.env.CAUSE_VIDEO_DURABLE_JOBS !== '1')
      return NextResponse.json({ error: 'The background materials worker is not enabled in this environment. Configure the QA materials and durable video workers before generating.' }, { status: 503 })
    const cause = await fetchQaCauseDetail(authorized.id)
    const token = await getQaAccessToken()
    if (!token) return NextResponse.json({error: 'Sign in again before generating materials.'}, {status: 401})
    const {job, reused} = getMaterialJobStore().enqueue({...cause}, token)
    startMaterialWorker()
    return NextResponse.json({generation: publicMaterialJob(job), reused}, {status: 202, headers: {'cache-control': 'no-store'}})
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not generate launch materials.' }, { status: 502 })
  }
}
